"""Rec 7 — Comprehension Failure Escalation.

Tracks comprehension failures per topic. After 2+ failures on the same
topic, switches to worked-example teaching mode. If still failing,
flags for human SME intervention.
"""

import json
import os
from datetime import datetime, timezone


TRACKER_DIR = "data/logs/comprehension"


class ComprehensionTracker:
    def __init__(self, tracker_dir: str = TRACKER_DIR):
        self.tracker_dir = tracker_dir
        os.makedirs(tracker_dir, exist_ok=True)

    def _load_state(self, teammate_id: str) -> dict:
        state_file = os.path.join(self.tracker_dir, f"{teammate_id}_comprehension.json")
        if os.path.exists(state_file):
            with open(state_file) as f:
                return json.load(f)
        return {"topics": {}, "worked_examples_triggered": [], "sme_flags": []}

    def _save_state(self, teammate_id: str, state: dict):
        state_file = os.path.join(self.tracker_dir, f"{teammate_id}_comprehension.json")
        with open(state_file, "w") as f:
            json.dump(state, f, indent=2)

    def record_failure(self, teammate_id: str, topic_key: str, standard_id: str, context: str) -> dict:
        state = self._load_state(teammate_id)
        topics = state["topics"]

        if topic_key not in topics:
            topics[topic_key] = {
                "standard_id": standard_id,
                "failure_count": 0,
                "failures": [],
                "mode": "standard",
            }

        topics[topic_key]["failure_count"] += 1
        topics[topic_key]["failures"].append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": context,
        })

        count = topics[topic_key]["failure_count"]
        result = {"failure_count": count, "action": "continue"}

        if count >= 2 and topics[topic_key]["mode"] == "standard":
            topics[topic_key]["mode"] = "worked_example"
            state["worked_examples_triggered"].append({
                "topic_key": topic_key,
                "standard_id": standard_id,
                "triggered_at": datetime.now(timezone.utc).isoformat(),
            })
            result["action"] = "switch_to_worked_example"
            result["instruction"] = (
                "Teammate has failed comprehension 2+ times on this topic. "
                "Switch to worked-example teaching mode: walk through a concrete "
                "scenario step by step rather than re-explaining the abstract rule."
            )

        if count >= 4 and topics[topic_key]["mode"] == "worked_example":
            topics[topic_key]["mode"] = "sme_flag"
            state["sme_flags"].append({
                "topic_key": topic_key,
                "standard_id": standard_id,
                "flagged_at": datetime.now(timezone.utc).isoformat(),
                "failure_count": count,
            })
            result["action"] = "flag_for_sme"
            result["instruction"] = (
                "Teammate has failed comprehension 4+ times even with worked examples. "
                "Flag this topic for human SME intervention via escalation."
            )

        self._save_state(teammate_id, state)
        return result

    def record_success(self, teammate_id: str, topic_key: str):
        state = self._load_state(teammate_id)
        if topic_key in state["topics"]:
            state["topics"][topic_key]["mode"] = "standard"
            state["topics"][topic_key]["failure_count"] = 0
        self._save_state(teammate_id, state)

    def get_topic_mode(self, teammate_id: str, topic_key: str) -> str:
        state = self._load_state(teammate_id)
        topic = state["topics"].get(topic_key, {})
        return topic.get("mode", "standard")

    def get_comprehension_report(self, teammate_id: str) -> dict:
        state = self._load_state(teammate_id)
        struggling_topics = {
            k: v for k, v in state["topics"].items() if v["failure_count"] >= 2
        }
        return {
            "teammate_id": teammate_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_tracked_topics": len(state["topics"]),
            "struggling_topics": struggling_topics,
            "worked_examples_triggered": state["worked_examples_triggered"],
            "sme_flags": state["sme_flags"],
        }
