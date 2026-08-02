"""
Escalation Handler — Tiered Resolution for Unresolvable Queries

Three-step escalation order:
1. Exhaust all ingested resource data (RAG, vector store, baseline docs)
2. If unresolved, perform web research (Firecrawl scrape of all potential
   NERC/FERC sources)
3. Only if still unresolved, escalate to an alternative user designated
   by the TM (not a generic queue — the TM specifies their escalation contact)

Escalation events are logged for audit trail purposes.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from profiles.teammate_store import TeammateStore


class EscalationHandler:
    def __init__(self, domain: str = "nerc_cip"):
        self.domain = domain
        self.store = TeammateStore()
        self.log_dir = Path(f"data/reports/escalations/{domain}")
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def set_escalation_contact(self, teammate_id: str, contact_name: str) -> dict:
        result = self.store.update(teammate_id, escalation_contact=contact_name)
        if not result:
            return {"error": f"Teammate '{teammate_id}' not found."}
        return {
            "teammate_id": teammate_id,
            "escalation_contact": contact_name,
            "message": f"Escalation contact set to '{contact_name}'.",
        }

    def get_escalation_contact(self, teammate_id: str) -> str:
        profile = self.store.get(teammate_id)
        return profile.get("escalation_contact", "") if profile else ""

    def log_escalation(
        self,
        teammate_id: str,
        question: str,
        tier1_result: str,
        tier2_result: str,
        escalation_contact: str,
    ) -> dict:
        now = datetime.now(timezone.utc)
        profile = self.store.get(teammate_id)

        entry = {
            "escalation_id": f"ESC-{teammate_id}-{now.strftime('%Y%m%d%H%M%S')}",
            "timestamp": now.isoformat(),
            "timestamp_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "teammate": {
                "id": teammate_id,
                "name": profile.get("name", teammate_id) if profile else teammate_id,
            },
            "question": question,
            "resolution_attempts": {
                "tier_1_resource_data": {
                    "status": "exhausted",
                    "result": tier1_result,
                },
                "tier_2_web_research": {
                    "status": "exhausted",
                    "result": tier2_result,
                },
                "tier_3_human_escalation": {
                    "status": "escalated",
                    "escalation_contact": escalation_contact,
                },
            },
            "status": "pending_human_review",
        }

        log_file = self.log_dir / f"{entry['escalation_id']}.json"
        with open(log_file, "w") as f:
            json.dump(entry, f, indent=2)

        return entry

    def get_pending_escalations(self) -> list:
        entries = []
        for log_file in sorted(self.log_dir.glob("ESC-*.json")):
            with open(log_file) as f:
                entry = json.load(f)
            if entry.get("status") == "pending_human_review":
                entries.append(entry)
        return entries

    def resolve_escalation(self, escalation_id: str, resolution: str) -> dict:
        log_file = self.log_dir / f"{escalation_id}.json"
        if not log_file.exists():
            return {"error": f"Escalation '{escalation_id}' not found."}

        with open(log_file) as f:
            entry = json.load(f)

        now = datetime.now(timezone.utc)
        entry["status"] = "resolved"
        entry["resolution"] = {
            "resolved_at": now.isoformat(),
            "resolved_at_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "resolution": resolution,
        }

        with open(log_file, "w") as f:
            json.dump(entry, f, indent=2)

        return entry
