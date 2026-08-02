#!/usr/bin/env python3
"""
CIPGuard AI Trainer — Entry Point

Usage:
    python main.py ingest --domain nerc_cip [--crawl] [--documents] [--all]
    python main.py update --domain nerc_cip                          # CF6: check for data changes
    python main.py history --domain nerc_cip                         # View version history
    python main.py history --domain nerc_cip --version 2             # View specific version
    python main.py report management --domain nerc_cip               # Team metrics report
    python main.py report management --drilldown CIP-007             # Drill into a gap area
    python main.py report cip004 --teammate john.doe                 # CIP-004 attestation for a TM
    python main.py report cip004                                     # CIP-004 team summary
    python main.py report growth --teammate john.doe                 # IQ growth report
    python main.py report growth                                     # Re-assessment status for all TMs
    python main.py report escalations                                # Pending escalations
    python main.py report attribution --teammate john.doe            # Source attribution audit
    python main.py report reasoning --teammate john.doe              # Reasoning journal analysis
    python main.py report comprehension --teammate john.doe          # Comprehension tracker
    python main.py run --domain nerc_cip --teammate john.doe [--name "John Doe"]
    python main.py voice --domain nerc_cip --teammate john.doe       # Voice training session (mic)
    python main.py serve --domain nerc_cip --port 8000               # API + WebSocket voice server
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import DEFAULT_DOMAIN
from agent.core_functions.reassessment_trigger import MINIMUM_INTERVAL_DAYS


def cmd_ingest(args):
    from data.ingestion.firecrawl_crawler import DomainCrawler
    from data.ingestion.document_loader import CustomerDocumentLoader
    from data.ingestion.chunker import DomainChunker
    from data.vectorstore.store import DomainVectorStore
    from data.ingestion.version_tracker import VersionTracker

    domain = args.domain or DEFAULT_DOMAIN
    store = DomainVectorStore(domain)
    chunker = DomainChunker()
    tracker = VersionTracker(domain)

    do_crawl = args.crawl or args.all
    do_docs = args.documents or args.all

    if not do_crawl and not do_docs:
        print("Specify --crawl, --documents, or --all")
        sys.exit(1)

    total_chunks = 0
    crawled_docs = []
    customer_docs = []

    if do_crawl:
        print(f"\n[Step 1.2a] Crawling external sources for domain '{domain}'...")
        crawler = DomainCrawler(domain)
        crawled_docs = crawler.crawl_all()
        print(f"  Crawled {len(crawled_docs)} pages total")

        print("[Step 1.2e] Saving crawl baseline...")
        baseline_path = crawler.save_baseline(crawled_docs)
        print(f"  Baseline saved: {baseline_path}")

        print("[Step 1.2c] Chunking crawled content...")
        chunks = chunker.chunk_crawled_docs(crawled_docs)
        added = store.add_documents(chunks)
        total_chunks += added
        print(f"  Added {added} chunks from web crawl")

    if do_docs:
        print(f"\n[Step 1.2b] Loading customer documents...")
        loader = CustomerDocumentLoader()
        doc_path = f"data/sources/"
        customer_docs = loader.load_directory(doc_path)
        print(f"  Loaded {len(customer_docs)} document sections")

        print("[Step 1.2c] Chunking documents...")
        chunks = chunker.chunk_documents(customer_docs)
        added = store.add_documents(chunks)
        total_chunks += added
        print(f"  Added {added} chunks from customer documents")

    print(f"\n[Step 1.2e] Recording version history...")
    if do_crawl and do_docs:
        version = tracker.record_initial_ingestion(crawled_docs, customer_docs)
    elif do_crawl:
        version = tracker.record_crawl_ingestion(crawled_docs)
    else:
        version = tracker.record_document_ingestion(customer_docs)
    print(f"  Version v{version['version']} recorded at {version['timestamp_human']}")

    print(f"\nIngestion complete. Total chunks in store: {store.count()}")


def cmd_update(args):
    from agent.core_functions.cf6_data_updater import KnowledgeUpdater

    domain = args.domain or DEFAULT_DOMAIN
    print(f"\n[CF6] Running data update check for domain '{domain}'...")
    updater = KnowledgeUpdater(domain)
    briefing = updater.get_deviation_briefing()
    if briefing:
        print(f"\n{briefing}")
    else:
        print("\nNo changes detected. Knowledge base is current.")


def cmd_history(args):
    from data.ingestion.version_tracker import VersionTracker

    domain = args.domain or DEFAULT_DOMAIN
    tracker = VersionTracker(domain)

    if args.version:
        version = tracker.get_version(args.version)
        if not version:
            print(f"Version {args.version} not found.")
            return
        import json
        print(json.dumps(version, indent=2))
    else:
        print(f"\n{'=' * 60}")
        print(f"  Ingestion Version History")
        print(f"{'=' * 60}")
        tracker.print_history()


def cmd_report(args):
    domain = args.domain or DEFAULT_DOMAIN
    report_type = args.type

    if report_type == "management":
        from agent.core_functions.cf7_management_analytics import ManagementAnalytics
        analytics = ManagementAnalytics(domain)
        if args.drilldown:
            analytics.print_drilldown(args.drilldown)
        else:
            analytics.print_report()

    elif report_type == "cip004":
        from agent.core_functions.cip004_training_support import CIP004TrainingSupport
        cip004 = CIP004TrainingSupport(domain)
        if args.teammate:
            cip004.print_tm_report(args.teammate)
        else:
            report = cip004.generate_team_attestation_report()
            import json
            print(json.dumps(report, indent=2))

    elif report_type == "growth":
        from agent.core_functions.reassessment_trigger import ReassessmentTrigger
        trigger = ReassessmentTrigger(domain)
        if args.teammate:
            trigger.print_growth_report(args.teammate)
        else:
            results = trigger.check_all_tms()
            print(f"\nRe-Assessment Status (threshold: {trigger.interval_days} days "
                  f"= max of {trigger.standard_count} standards, {MINIMUM_INTERVAL_DAYS} day minimum):")
            for r in results:
                status = "DUE" if r["due"] else "not due"
                print(f"  {r.get('name', r['teammate_id'])}: {status} — {r['reason']}")

    elif report_type == "escalations":
        from agent.core_functions.escalation_handler import EscalationHandler
        handler = EscalationHandler(domain)
        pending = handler.get_pending_escalations()
        if not pending:
            print("\nNo pending escalations.")
        else:
            print(f"\n{len(pending)} pending escalation(s):")
            for esc in pending:
                print(f"\n  ID: {esc['escalation_id']}")
                print(f"  TM: {esc['teammate']['name']}")
                print(f"  Date: {esc['timestamp_human']}")
                print(f"  Question: {esc['question'][:100]}")
                print(f"  Escalated to: {esc['resolution_attempts']['tier_3_human_escalation']['escalation_contact']}")

    elif report_type == "attribution":
        from agent.core_functions.source_attribution import SourceAttributionLogger
        logger = SourceAttributionLogger()
        if not args.teammate:
            print("Error: --teammate required for attribution report")
            return
        report = logger.generate_audit_report(args.teammate)
        import json
        print(json.dumps(report, indent=2))

    elif report_type == "reasoning":
        from agent.core_functions.reasoning_journal import ReasoningJournal
        journal = ReasoningJournal()
        if not args.teammate:
            print("Error: --teammate required for reasoning report")
            return
        report = journal.get_longitudinal_report(args.teammate)
        import json
        print(json.dumps(report, indent=2))

    elif report_type == "comprehension":
        from agent.core_functions.comprehension_tracker import ComprehensionTracker
        tracker = ComprehensionTracker()
        if not args.teammate:
            print("Error: --teammate required for comprehension report")
            return
        report = tracker.get_comprehension_report(args.teammate)
        import json
        print(json.dumps(report, indent=2))

    else:
        print("Unknown report type. Use: management, cip004, growth, escalations, attribution, reasoning, comprehension")


def cmd_run(args):
    from agent.orchestrator import CIPGuardOrchestrator

    domain = args.domain or DEFAULT_DOMAIN
    teammate_id = args.teammate
    teammate_name = args.name

    if not teammate_id:
        print("Error: --teammate is required")
        sys.exit(1)

    orchestrator = CIPGuardOrchestrator(domain)
    orchestrator.run_session(teammate_id, teammate_name)


def cmd_voice(args):
    """CLI voice mode — microphone-based training session."""
    from config.settings import VOICE_ENABLED
    if not VOICE_ENABLED:
        print("Voice is disabled. Set VOICE_ENABLED=true in .env")
        sys.exit(1)

    try:
        import sounddevice as sd
    except ImportError:
        print("Voice CLI requires: pip install sounddevice")
        sys.exit(1)

    from voice.pipeline import VoicePipeline

    domain = args.domain or DEFAULT_DOMAIN
    teammate_id = args.teammate
    if not teammate_id:
        print("Error: --teammate is required")
        sys.exit(1)

    pipeline = VoicePipeline(domain=domain, stt_engine=args.stt, tts_engine=args.tts)
    status = pipeline.get_status()
    print(f"\nCIPGuard Voice Training Session")
    print(f"  Teammate: {teammate_id}")
    print(f"  STT: {status['stt_engine']}  |  TTS: {status['tts_engine']}  |  VAD: {status['vad_engine']}")
    print(f"  Sample rate: {status['sample_rate']} Hz")
    print(f"\nSpeak into your microphone. Press Ctrl+C to end.\n")

    sample_rate = status["sample_rate"]
    chunk_samples = int(sample_rate * 0.5)
    is_recording = True

    def audio_callback(indata, frames, time_info, cb_status):
        if not is_recording:
            return
        audio_bytes = (indata[:, 0] * 32767).astype("int16").tobytes()
        vad_state = pipeline.process_audio_chunk(audio_bytes)

        if vad_state["speech_started"]:
            print("  [listening...]", end="", flush=True)

        if vad_state["speech_ended"]:
            full_audio = pipeline.get_and_clear_buffer()
            result = pipeline.process_audio_turn(full_audio, teammate_id)
            if result["transcription"]:
                print(f"\r  You: {result['transcription']}")
                print(f"  AI:  {result['response_text']}\n")

                if result["response_audio"]:
                    import numpy as np
                    audio_np = np.frombuffer(result["response_audio"], dtype=np.int16).astype("float32") / 32767
                    sd.play(audio_np, result["response_sample_rate"], blocking=True)

    try:
        with sd.InputStream(
            samplerate=sample_rate,
            channels=1,
            dtype="float32",
            blocksize=chunk_samples,
            callback=audio_callback,
        ):
            while True:
                sd.sleep(100)
    except KeyboardInterrupt:
        is_recording = False
        print("\n\nSession ended.")


def cmd_serve(args):
    try:
        import uvicorn
        from fastapi import FastAPI, Request, HTTPException
        from fastapi.middleware.cors import CORSMiddleware
        from pydantic import BaseModel
    except ImportError:
        print("API server requires: pip install fastapi uvicorn")
        sys.exit(1)

    from agent.orchestrator import CIPGuardOrchestrator
    from config.settings import VOICE_ENABLED, USE_SUPABASE, CORS_ORIGINS, SUPABASE_JWT_SECRET

    app = FastAPI(
        title="CIPGuard AI Trainer API",
        description="NERC CIP Compliance Training Companion API",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if VOICE_ENABLED:
        from voice.websocket_handler import create_voice_websocket_routes
        create_voice_websocket_routes(app, args.domain or DEFAULT_DOMAIN)
        print("  Voice WebSocket enabled at ws://<host>:<port>/voice/{teammate_id}")

    sessions = {}
    _store = None

    def _get_store():
        nonlocal _store
        if _store is None and USE_SUPABASE:
            from profiles.supabase_store import SupabaseTeammateStore
            from config.settings import SUPABASE_URL, SUPABASE_SERVICE_KEY
            _store = SupabaseTeammateStore(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        return _store

    def _verify_jwt(request: Request) -> str:
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization header")
        token = auth_header[7:]

        if SUPABASE_JWT_SECRET:
            try:
                import jwt as pyjwt
                payload = pyjwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
                return payload["sub"]
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
        else:
            try:
                import jwt as pyjwt
                payload = pyjwt.decode(token, options={"verify_signature": False})
                user_id = payload.get("sub")
                if not user_id:
                    raise HTTPException(status_code=401, detail="Token missing sub claim")
                return user_id
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    class MessageRequest(BaseModel):
        message: str
        domain: str = args.domain or DEFAULT_DOMAIN

    class MessageResponse(BaseModel):
        response: str
        iq_score: float
        iq_level: str
        interaction_count: int
        baseline_completed: bool

    class StatusResponse(BaseModel):
        overall_iq: float
        per_standard: dict
        strengths: list
        gaps: list
        interaction_count: int
        baseline_completed: bool
        escalation_contact: str

    class ConversationResponse(BaseModel):
        messages: list

    @app.post("/chat", response_model=MessageResponse)
    async def chat(request: MessageRequest, req: Request):
        user_id = _verify_jwt(req)
        domain = request.domain
        session_key = f"{domain}:{user_id}"

        store = _get_store()
        if session_key not in sessions:
            orch = CIPGuardOrchestrator(domain, teammate_store=store)
            if store:
                history = store.load_conversation_history(user_id)
                if history:
                    orch.conversation_history = history
            sessions[session_key] = orch

        orchestrator = sessions[session_key]
        response = orchestrator.process_message(user_id, request.message)
        profile = orchestrator.teammate_store.get(user_id)

        if store:
            store.save_conversation_turn(user_id, "user", request.message)
            store.save_conversation_turn(user_id, "assistant", response)

        iq = profile.get("iq_score", 0)
        levels = orchestrator.domain_config["assessment"]["iq_scale"]["levels"]
        level = "Unassessed"
        for lvl in levels:
            if lvl["range"][0] <= iq <= lvl["range"][1]:
                level = lvl["label"]
                break

        return MessageResponse(
            response=response,
            iq_score=iq,
            iq_level=level,
            interaction_count=profile.get("interaction_count", 0),
            baseline_completed=bool(profile.get("baseline_completed", 0)),
        )

    @app.get("/status", response_model=StatusResponse)
    async def status(req: Request, domain: str = None):
        user_id = _verify_jwt(req)
        domain = domain or args.domain or DEFAULT_DOMAIN
        session_key = f"{domain}:{user_id}"

        store = _get_store()
        if session_key not in sessions:
            sessions[session_key] = CIPGuardOrchestrator(domain, teammate_store=store)
        orchestrator = sessions[session_key]

        profile = orchestrator.teammate_store.get_or_create(user_id, domain=domain)
        summary = orchestrator.iq_tracker.get_iq_summary(user_id)

        return StatusResponse(
            overall_iq=summary.get("overall", 0),
            per_standard=summary.get("per_standard", {}),
            strengths=summary.get("strengths", []),
            gaps=summary.get("gaps", []),
            interaction_count=summary.get("interaction_count", 0),
            baseline_completed=bool(profile.get("baseline_completed", 0)),
            escalation_contact=profile.get("escalation_contact", ""),
        )

    @app.get("/history", response_model=ConversationResponse)
    async def get_history(req: Request):
        user_id = _verify_jwt(req)
        store = _get_store()
        if store:
            messages = store.load_conversation_history(user_id, limit=100)
        else:
            messages = []
        return ConversationResponse(messages=messages)

    @app.delete("/history")
    async def clear_history(req: Request):
        user_id = _verify_jwt(req)
        store = _get_store()
        if store:
            store.clear_conversation_history(user_id)
        session_key = f"{args.domain or DEFAULT_DOMAIN}:{user_id}"
        if session_key in sessions:
            sessions[session_key].conversation_history = []
        return {"cleared": True}

    @app.post("/update")
    async def trigger_update(req: Request, domain: str = None):
        _verify_jwt(req)
        from agent.core_functions.cf6_data_updater import KnowledgeUpdater

        domain = domain or args.domain or DEFAULT_DOMAIN
        updater = KnowledgeUpdater(domain)
        return updater.check_and_update()

    @app.get("/health")
    async def health():
        return {"status": "ok", "supabase": USE_SUPABASE, "voice": VOICE_ENABLED}

    port = args.port or 8000
    print(f"\nStarting CIPGuard AI Trainer API on port {port}...")
    print(f"  Supabase integration: {'enabled' if USE_SUPABASE else 'disabled (using local SQLite)'}")
    print(f"  CORS origins: {CORS_ORIGINS}")
    uvicorn.run(app, host="0.0.0.0", port=port)


def main():
    parser = argparse.ArgumentParser(
        description="CIPGuard AI Trainer — Compliance Training Companion"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    ingest_parser = subparsers.add_parser("ingest", help="Ingest domain data")
    ingest_parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    ingest_parser.add_argument("--crawl", action="store_true", help="Crawl web sources via Firecrawl")
    ingest_parser.add_argument("--documents", action="store_true", help="Load customer documents")
    ingest_parser.add_argument("--all", action="store_true", help="Both crawl and documents")

    update_parser = subparsers.add_parser("update", help="CF6: Check for data changes against baseline")
    update_parser.add_argument("--domain", default=DEFAULT_DOMAIN)

    history_parser = subparsers.add_parser("history", help="View ingestion version history with timestamps")
    history_parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    history_parser.add_argument("--version", type=int, help="Show details for a specific version number")

    report_parser = subparsers.add_parser("report", help="Generate reports")
    report_parser.add_argument("type", choices=["management", "cip004", "growth", "escalations", "attribution", "reasoning", "comprehension"],
                               help="Report type: management, cip004, growth, escalations, attribution, reasoning, comprehension")
    report_parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    report_parser.add_argument("--teammate", help="Teammate ID (for cip004 and growth reports)")
    report_parser.add_argument("--drilldown", help="Standard ID to drill into (for management report)")

    run_parser = subparsers.add_parser("run", help="Start interactive training session")
    run_parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    run_parser.add_argument("--teammate", required=True, help="Teammate ID")
    run_parser.add_argument("--name", help="Teammate display name")

    voice_parser = subparsers.add_parser("voice", help="Start voice training session (microphone)")
    voice_parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    voice_parser.add_argument("--teammate", required=True, help="Teammate ID")
    voice_parser.add_argument("--stt", default=None, help="STT engine override (granite, moonshine, parakeet, whisper)")
    voice_parser.add_argument("--tts", default=None, help="TTS engine override (kokoro, chatterbox, piper)")

    serve_parser = subparsers.add_parser("serve", help="Start API + voice WebSocket server")
    serve_parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    serve_parser.add_argument("--port", type=int, default=8000)

    args = parser.parse_args()

    if args.command == "ingest":
        cmd_ingest(args)
    elif args.command == "update":
        cmd_update(args)
    elif args.command == "history":
        cmd_history(args)
    elif args.command == "report":
        cmd_report(args)
    elif args.command == "run":
        cmd_run(args)
    elif args.command == "voice":
        cmd_voice(args)
    elif args.command == "serve":
        cmd_serve(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
