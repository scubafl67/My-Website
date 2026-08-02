"""Rec 5 — Teammate Reasoning Journal.

Persists structured reasoning quality data per teammate for longitudinal
analysis across sessions.
"""

import json
import os
from datetime import datetime, timezone


JOURNAL_DIR = "data/logs/reasoning_journal"


class ReasoningJournal:
    def __init__(self, journal_dir: str = JOURNAL_DIR):
        self.journal_dir = journal_dir
        os.makedirs(journal_dir, exist_ok=True)

    def record_entry(
        self,
        teammate_id: str,
        standard_id: str,
        requirement_id: str,
        options_presented: list[str],
        option_chosen: str,
        reasoning_given: str,
        ai_assessment: str,
        reasoning_depth: str,
        cross_standard_awareness: bool = False,
        missed_implications: list[str] | None = None,
    ) -> dict:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "teammate_id": teammate_id,
            "standard_id": standard_id,
            "requirement_id": requirement_id,
            "options_presented": options_presented,
            "option_chosen": option_chosen,
            "reasoning_given": reasoning_given,
            "ai_assessment": ai_assessment,
            "reasoning_depth": reasoning_depth,
            "cross_standard_awareness": cross_standard_awareness,
            "missed_implications": missed_implications or [],
        }

        journal_file = os.path.join(self.journal_dir, f"{teammate_id}_journal.jsonl")
        with open(journal_file, "a") as f:
            f.write(json.dumps(entry) + "\n")

        return entry

    def get_journal(self, teammate_id: str, limit: int = 100) -> list:
        journal_file = os.path.join(self.journal_dir, f"{teammate_id}_journal.jsonl")
        if not os.path.exists(journal_file):
            return []
        entries = []
        with open(journal_file) as f:
            for line in f:
                if line.strip():
                    entries.append(json.loads(line))
        return entries[-limit:]

    def get_reasoning_trends(self, teammate_id: str) -> dict:
        entries = self.get_journal(teammate_id, limit=9999)
        if not entries:
            return {"total_entries": 0}

        depth_counts = {}
        standard_counts = {}
        cross_awareness_count = 0
        total_missed = 0

        for e in entries:
            depth = e["reasoning_depth"]
            depth_counts[depth] = depth_counts.get(depth, 0) + 1

            std = e["standard_id"]
            standard_counts[std] = standard_counts.get(std, 0) + 1

            if e["cross_standard_awareness"]:
                cross_awareness_count += 1

            total_missed += len(e.get("missed_implications", []))

        total = len(entries)
        return {
            "total_entries": total,
            "reasoning_depth_distribution": depth_counts,
            "standards_discussed": standard_counts,
            "cross_standard_awareness_rate": round(cross_awareness_count / total * 100, 1),
            "avg_missed_implications": round(total_missed / total, 2),
        }

    def get_longitudinal_report(self, teammate_id: str) -> dict:
        entries = self.get_journal(teammate_id, limit=9999)
        if not entries:
            return {"teammate_id": teammate_id, "status": "no_entries"}

        depth_order = {"surface": 0, "adequate": 1, "thorough": 2, "expert": 3}
        scored = [depth_order.get(e["reasoning_depth"], 1) for e in entries]

        if len(scored) >= 6:
            first_half = scored[: len(scored) // 2]
            second_half = scored[len(scored) // 2 :]
            trajectory = "improving" if sum(second_half) / len(second_half) > sum(first_half) / len(first_half) else "stable_or_declining"
        else:
            trajectory = "insufficient_data"

        return {
            "teammate_id": teammate_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_entries": len(entries),
            "trends": self.get_reasoning_trends(teammate_id),
            "trajectory": trajectory,
            "entries": entries,
        }
