"""Rec 3 — Source Attribution Logging.

Logs which knowledge source answered each question for compliance auditability.
"""

import json
import os
from datetime import datetime, timezone


ATTRIBUTION_LOG_DIR = "data/logs/source_attribution"


class SourceAttributionLogger:
    def __init__(self, log_dir: str = ATTRIBUTION_LOG_DIR):
        self.log_dir = log_dir
        os.makedirs(log_dir, exist_ok=True)

    def log_attribution(
        self,
        teammate_id: str,
        question_summary: str,
        source_type: str,
        source_detail: str,
        standard_cited: str = "",
        tool_used: str = "",
        confidence: float = 1.0,
    ) -> dict:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "teammate_id": teammate_id,
            "question_summary": question_summary,
            "source_type": source_type,
            "source_detail": source_detail,
            "standard_cited": standard_cited,
            "tool_used": tool_used,
            "confidence": confidence,
        }

        log_file = os.path.join(self.log_dir, f"{teammate_id}_attributions.jsonl")
        with open(log_file, "a") as f:
            f.write(json.dumps(entry) + "\n")

        return entry

    def get_attributions(self, teammate_id: str, limit: int = 50) -> list:
        log_file = os.path.join(self.log_dir, f"{teammate_id}_attributions.jsonl")
        if not os.path.exists(log_file):
            return []
        entries = []
        with open(log_file) as f:
            for line in f:
                if line.strip():
                    entries.append(json.loads(line))
        return entries[-limit:]

    def get_source_distribution(self, teammate_id: str) -> dict:
        attributions = self.get_attributions(teammate_id, limit=9999)
        dist = {}
        for entry in attributions:
            src = entry["source_type"]
            dist[src] = dist.get(src, 0) + 1
        total = len(attributions)
        return {
            "total_queries": total,
            "by_source": dist,
            "percentages": {k: round(v / total * 100, 1) for k, v in dist.items()} if total else {},
        }

    def generate_audit_report(self, teammate_id: str) -> dict:
        attributions = self.get_attributions(teammate_id, limit=9999)
        standards_cited = {}
        for entry in attributions:
            std = entry.get("standard_cited", "")
            if std:
                standards_cited[std] = standards_cited.get(std, 0) + 1

        return {
            "teammate_id": teammate_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_interactions": len(attributions),
            "source_distribution": self.get_source_distribution(teammate_id),
            "standards_cited": standards_cited,
            "entries": attributions,
        }
