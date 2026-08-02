"""Voice pipeline orchestrator.

Manages the full bidirectional voice flow:
  Teammate speaks → VAD → STT → Claude API → TTS → Audio output

Supports both CLI (microphone) mode and WebSocket (React App) mode.
"""

import json
import base64
import asyncio
import yaml
from pathlib import Path
from voice.stt_engine import create_stt_engine
from voice.tts_engine import create_tts_engine
from voice.vad import VoiceActivityDetector
from agent.orchestrator import CIPGuardOrchestrator


def load_voice_config() -> dict:
    config_path = Path(__file__).parent / "voice_config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


class VoicePipeline:
    """Orchestrates STT → Agent → TTS for a single teammate session."""

    def __init__(
        self,
        domain: str = "nerc_cip",
        stt_engine: str = None,
        tts_engine: str = None,
    ):
        self.config = load_voice_config()
        self.stt = create_stt_engine(stt_engine)
        self.tts = create_tts_engine(tts_engine)
        self.vad = VoiceActivityDetector(self.config.get("vad"))
        self.orchestrator = CIPGuardOrchestrator(domain)
        self.domain = domain
        self._audio_buffer = bytearray()
        self._pipeline_config = self.config.get("pipeline", {})
        self._max_turn_s = self._pipeline_config.get("max_turn_duration_s", 30)
        self._sample_rate = self.config["stt"]["engines"][self.stt.engine_name]["sample_rate"]

    def process_audio_turn(self, audio_data: bytes, teammate_id: str) -> dict:
        """Process a complete audio turn (after VAD detects end of speech).

        Args:
            audio_data: Raw PCM s16le audio bytes
            teammate_id: The teammate's ID

        Returns:
            {
                "transcription": str,
                "response_text": str,
                "response_audio": bytes,
                "response_sample_rate": int,
                "stt_engine": str,
                "tts_engine": str,
            }
        """
        stt_result = self.stt.transcribe(audio_data, self._sample_rate)
        transcription = stt_result["text"]

        if not transcription.strip():
            return {
                "transcription": "",
                "response_text": "",
                "response_audio": b"",
                "response_sample_rate": 0,
                "stt_engine": self.stt.engine_name,
                "tts_engine": self.tts.engine_name,
            }

        response_text = self.orchestrator.process_message(teammate_id, transcription)
        tts_result = self.tts.synthesize(response_text)

        return {
            "transcription": transcription,
            "response_text": response_text,
            "response_audio": tts_result["audio"],
            "response_sample_rate": tts_result["sample_rate"],
            "response_duration_s": tts_result.get("duration_s", 0),
            "stt_engine": self.stt.engine_name,
            "tts_engine": self.tts.engine_name,
        }

    def process_audio_chunk(self, audio_chunk: bytes) -> dict:
        """Process an incoming audio chunk through VAD.

        Returns VAD state. When speech_ended is True, caller should
        call process_audio_turn with the accumulated buffer.
        """
        vad_state = self.vad.process_chunk(audio_chunk, self._sample_rate)

        if vad_state["is_speech"] or vad_state["speech_ended"]:
            self._audio_buffer.extend(audio_chunk)

        if vad_state["speech_started"]:
            self._audio_buffer = bytearray(audio_chunk)

        max_samples = self._max_turn_s * self._sample_rate * 2
        if len(self._audio_buffer) > max_samples:
            vad_state["speech_ended"] = True

        return {
            **vad_state,
            "buffer_size": len(self._audio_buffer),
        }

    def get_and_clear_buffer(self) -> bytes:
        """Get the accumulated audio buffer and clear it."""
        data = bytes(self._audio_buffer)
        self._audio_buffer = bytearray()
        self.vad.reset()
        return data

    def reset(self):
        """Reset pipeline state for a new conversation."""
        self._audio_buffer = bytearray()
        self.vad.reset()
        self.stt.reset_stream()

    def get_status(self) -> dict:
        return {
            "stt_engine": self.stt.engine_name,
            "tts_engine": self.tts.engine_name,
            "vad_engine": "silero",
            "domain": self.domain,
            "sample_rate": self._sample_rate,
            "streaming_supported": self.stt.supports_streaming,
        }


class VoicePipelineManager:
    """Manages multiple VoicePipeline instances for concurrent sessions."""

    def __init__(self, domain: str = "nerc_cip"):
        self.domain = domain
        self._pipelines: dict[str, VoicePipeline] = {}

    def get_pipeline(
        self,
        session_key: str,
        stt_engine: str = None,
        tts_engine: str = None,
    ) -> VoicePipeline:
        if session_key not in self._pipelines:
            self._pipelines[session_key] = VoicePipeline(
                domain=self.domain,
                stt_engine=stt_engine,
                tts_engine=tts_engine,
            )
        return self._pipelines[session_key]

    def remove_pipeline(self, session_key: str):
        self._pipelines.pop(session_key, None)

    def list_sessions(self) -> list[str]:
        return list(self._pipelines.keys())
