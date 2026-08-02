"""WebSocket handler for real-time voice communication with the React App.

Protocol:
  Client → Server (JSON):
    {"type": "audio", "data": "<base64 PCM s16le>", "teammate_id": "..."}
    {"type": "config", "stt_engine": "granite", "tts_engine": "kokoro"}
    {"type": "text", "message": "...", "teammate_id": "..."}  # text fallback
    {"type": "ping"}

  Server → Client (JSON):
    {"type": "vad", "is_speech": true, "confidence": 0.85}
    {"type": "transcription", "text": "...", "partial": false}
    {"type": "response_text", "text": "...", "iq_score": 45.0, "iq_level": "Developing"}
    {"type": "response_audio", "data": "<base64 PCM>", "sample_rate": 24000, "partial": false}
    {"type": "status", ...pipeline status...}
    {"type": "error", "message": "..."}
    {"type": "pong"}
"""

import json
import base64
import asyncio
from voice.pipeline import VoicePipelineManager


def create_voice_websocket_routes(app, domain: str = "nerc_cip"):
    """Attach WebSocket voice routes to a FastAPI app."""

    from fastapi import WebSocket, WebSocketDisconnect

    manager = VoicePipelineManager(domain)

    @app.websocket("/voice/{teammate_id}")
    async def voice_session(websocket: WebSocket, teammate_id: str):
        await websocket.accept()
        session_key = f"{domain}:{teammate_id}"

        stt_engine = None
        tts_engine = None

        try:
            pipeline = manager.get_pipeline(session_key, stt_engine, tts_engine)

            await websocket.send_json({
                "type": "status",
                **pipeline.get_status(),
                "teammate_id": teammate_id,
            })

            while True:
                raw = await websocket.receive_text()
                msg = json.loads(raw)
                msg_type = msg.get("type", "")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type == "config":
                    new_stt = msg.get("stt_engine")
                    new_tts = msg.get("tts_engine")
                    if new_stt or new_tts:
                        manager.remove_pipeline(session_key)
                        pipeline = manager.get_pipeline(
                            session_key,
                            stt_engine=new_stt or stt_engine,
                            tts_engine=new_tts or tts_engine,
                        )
                        stt_engine = new_stt or stt_engine
                        tts_engine = new_tts or tts_engine
                    await websocket.send_json({
                        "type": "status",
                        **pipeline.get_status(),
                    })

                elif msg_type == "audio":
                    audio_b64 = msg.get("data", "")
                    audio_bytes = base64.b64decode(audio_b64)

                    vad_state = pipeline.process_audio_chunk(audio_bytes)

                    await websocket.send_json({
                        "type": "vad",
                        "is_speech": vad_state["is_speech"],
                        "confidence": vad_state["confidence"],
                    })

                    if vad_state["speech_ended"]:
                        full_audio = pipeline.get_and_clear_buffer()

                        result = await asyncio.to_thread(
                            pipeline.process_audio_turn,
                            full_audio,
                            teammate_id,
                        )

                        if result["transcription"]:
                            await websocket.send_json({
                                "type": "transcription",
                                "text": result["transcription"],
                                "partial": False,
                                "stt_engine": result["stt_engine"],
                            })

                            profile = pipeline.orchestrator.teammate_store.get(teammate_id)
                            iq = profile.get("iq_score", 0) if profile else 0
                            levels = pipeline.orchestrator.domain_config["assessment"]["iq_scale"]["levels"]
                            iq_level = "Unassessed"
                            for lvl in levels:
                                if lvl["range"][0] <= iq <= lvl["range"][1]:
                                    iq_level = lvl["label"]
                                    break

                            await websocket.send_json({
                                "type": "response_text",
                                "text": result["response_text"],
                                "iq_score": iq,
                                "iq_level": iq_level,
                                "interaction_count": profile.get("interaction_count", 0) if profile else 0,
                            })

                            if result["response_audio"]:
                                audio_b64_out = base64.b64encode(result["response_audio"]).decode()
                                await websocket.send_json({
                                    "type": "response_audio",
                                    "data": audio_b64_out,
                                    "sample_rate": result["response_sample_rate"],
                                    "duration_s": result.get("response_duration_s", 0),
                                    "tts_engine": result["tts_engine"],
                                    "partial": False,
                                })

                elif msg_type == "text":
                    message = msg.get("message", "").strip()
                    if message:
                        response_text = await asyncio.to_thread(
                            pipeline.orchestrator.process_message,
                            teammate_id,
                            message,
                        )

                        profile = pipeline.orchestrator.teammate_store.get(teammate_id)
                        iq = profile.get("iq_score", 0) if profile else 0

                        await websocket.send_json({
                            "type": "response_text",
                            "text": response_text,
                            "iq_score": iq,
                        })

                        tts_result = await asyncio.to_thread(
                            pipeline.tts.synthesize, response_text
                        )
                        if tts_result["audio"]:
                            audio_b64_out = base64.b64encode(tts_result["audio"]).decode()
                            await websocket.send_json({
                                "type": "response_audio",
                                "data": audio_b64_out,
                                "sample_rate": tts_result["sample_rate"],
                                "duration_s": tts_result.get("duration_s", 0),
                                "tts_engine": pipeline.tts.engine_name,
                                "partial": False,
                            })

        except WebSocketDisconnect:
            manager.remove_pipeline(session_key)
        except Exception as e:
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass
            manager.remove_pipeline(session_key)
