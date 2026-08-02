"""
Scheduled Re-Assessment Trigger

Checks whether a TM is due for a re-baseline assessment based on:
1. The GREATER of: number of domain standards OR 14 days (two weeks)
2. TM must have completed the initial baseline first

For NERC CIP with 14 standards (CIP-002 through CIP-015), the threshold
is 14 days (since 14 = 14). For a domain with 20+ standards, the
threshold would be 20 days.

When triggered, generates a growth report comparing current IQ against
initial IQ (#1).
"""

import yaml
from datetime import datetime, timezone, timedelta
from profiles.teammate_store import TeammateStore

MINIMUM_INTERVAL_DAYS = 14


class ReassessmentTrigger:
    def __init__(self, domain: str = "nerc_cip", interval_days: int = None):
        self.domain = domain
        self.store = TeammateStore()
        self.standard_count = self._count_standards()
        self.interval_days = interval_days or max(self.standard_count, MINIMUM_INTERVAL_DAYS)

    def _count_standards(self) -> int:
        try:
            with open(f"domains/{self.domain}/domain_config.yaml") as f:
                config = yaml.safe_load(f)
            return len(config.get("standards", {}).get("categories", []))
        except Exception:
            return 0

    def check_tm(self, teammate_id: str) -> dict:
        profile = self.store.get(teammate_id)
        if not profile:
            return {"due": False, "reason": "Teammate not found."}

        if not profile.get("iq_history"):
            return {
                "due": False,
                "reason": "TM has not completed initial baseline assessment. Re-assessment cannot trigger until baseline is established.",
            }

        iq_history = profile["iq_history"]
        initial_entry = iq_history[0]
        latest_entry = iq_history[-1]

        initial_timestamp = datetime.fromisoformat(initial_entry["timestamp"])
        latest_timestamp = datetime.fromisoformat(latest_entry["timestamp"])
        now = datetime.now(timezone.utc)

        days_since_latest = (now - latest_timestamp).days
        due = days_since_latest >= self.interval_days

        return {
            "teammate_id": teammate_id,
            "name": profile["name"],
            "due": due,
            "days_since_last_assessment": days_since_latest,
            "interval_days": self.interval_days,
            "initial_baseline_date": initial_entry["timestamp"],
            "last_assessment_date": latest_entry["timestamp"],
            "reason": (
                f"Re-assessment due: {days_since_latest} days since last assessment "
                f"(threshold: {self.interval_days} days)."
                if due
                else f"Not yet due: {days_since_latest} of {self.interval_days} days elapsed."
            ),
        }

    def check_all_tms(self) -> list:
        session = self.store.Session()
        try:
            from profiles.models import TeammateProfile
            profiles = session.query(TeammateProfile).filter_by(domain=self.domain).all()
            results = []
            for p in profiles:
                results.append(self.check_tm(p.id))
            return results
        finally:
            session.close()

    def generate_growth_report(self, teammate_id: str) -> dict:
        profile = self.store.get(teammate_id)
        if not profile or not profile.get("iq_history"):
            return {"error": "No baseline data available for growth report."}

        now = datetime.now(timezone.utc)
        iq_history = profile["iq_history"]
        initial_entry = iq_history[0]

        initial_overall = initial_entry.get("overall", 0)
        current_overall = profile.get("iq_score", 0)

        per_std_current = profile.get("iq_per_standard", {})

        per_std_initial = {}
        for entry in iq_history:
            std = entry.get("standard_id")
            if std and std not in per_std_initial:
                prev = entry.get("previous", entry.get("new", 0))
                per_std_initial[std] = prev

        per_standard_growth = []
        for std_id in sorted(set(list(per_std_current.keys()) + list(per_std_initial.keys()))):
            initial = per_std_initial.get(std_id, 0)
            current = per_std_current.get(std_id, 0)
            delta = round(current - initial, 1)
            per_standard_growth.append({
                "standard_id": std_id,
                "initial_score": initial,
                "current_score": current,
                "delta": delta,
                "direction": "improvement" if delta > 0 else "regression" if delta < 0 else "unchanged",
            })

        return {
            "report_type": "Growth Report — Re-Assessment",
            "generated_at": now.isoformat(),
            "generated_at_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "teammate": {
                "id": profile["id"],
                "name": profile["name"],
            },
            "baseline_date": initial_entry["timestamp"],
            "current_date": now.isoformat(),
            "overall_growth": {
                "initial_iq": initial_overall,
                "current_iq": current_overall,
                "delta": round(current_overall - initial_overall, 1),
            },
            "per_standard_growth": per_standard_growth,
            "total_interactions": profile.get("interaction_count", 0),
            "current_strengths": profile.get("strengths", []),
            "current_gaps": profile.get("gaps", []),
        }

    def print_growth_report(self, teammate_id: str):
        report = self.generate_growth_report(teammate_id)
        if "error" in report:
            print(f"  Error: {report['error']}")
            return

        tm = report["teammate"]
        og = report["overall_growth"]

        print(f"\n{'=' * 60}")
        print(f"  GROWTH REPORT — {tm['name']}")
        print(f"  Generated: {report['generated_at_human']}")
        print(f"{'=' * 60}")
        print(f"  Baseline Date:    {report['baseline_date']}")
        print(f"  Total Interactions: {report['total_interactions']}")
        print(f"\n  Overall IQ: {og['initial_iq']} → {og['current_iq']} "
              f"({'+' if og['delta'] >= 0 else ''}{og['delta']})")

        print(f"\n  {'─' * 40}")
        print(f"  PER-STANDARD GROWTH")
        print(f"  {'─' * 40}")
        for item in report["per_standard_growth"]:
            arrow = "↑" if item["delta"] > 0 else "↓" if item["delta"] < 0 else "→"
            print(f"    {item['standard_id']}: {item['initial_score']} → {item['current_score']} "
                  f"{arrow} ({'+' if item['delta'] >= 0 else ''}{item['delta']})")

        print(f"\n  Strengths: {', '.join(report['current_strengths']) or 'None yet'}")
        print(f"  Gaps: {', '.join(report['current_gaps']) or 'None yet'}")
        print(f"{'=' * 60}\n")
