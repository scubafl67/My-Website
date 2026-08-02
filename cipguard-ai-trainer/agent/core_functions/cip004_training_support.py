"""
CIP-004 Internal Control Training Support

Auto-generates attestation reports from training interactions that serve
as CIP-004 (Personnel & Training) compliance evidence. Each report shows:
- Training topics covered per TM
- Comprehension confirmations
- IQ progression over time
- Standards addressed and gap remediation progress

These reports are designed for audit readiness — they document that
each TM received training, demonstrated comprehension, and showed
measurable knowledge progression.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from profiles.teammate_store import TeammateStore
from profiles.models import InteractionLog


class CIP004TrainingSupport:
    def __init__(self, domain: str = "nerc_cip"):
        self.domain = domain
        self.store = TeammateStore()
        self.report_dir = Path(f"data/reports/cip004/{domain}")
        self.report_dir.mkdir(parents=True, exist_ok=True)

    def generate_tm_attestation_report(self, teammate_id: str) -> dict:
        profile = self.store.get(teammate_id)
        if not profile:
            return {"error": f"Teammate '{teammate_id}' not found."}

        now = datetime.now(timezone.utc)
        logs = self._get_logs(teammate_id)

        standards_trained = set()
        comprehension_confirmations = 0
        total_interactions = len(logs)

        for log in logs:
            if log.get("topic_standard"):
                standards_trained.add(log["topic_standard"])
            if log.get("reasoning_quality") in ("confirmed", "comprehension_verified"):
                comprehension_confirmations += 1

        iq_history = profile.get("iq_history", [])
        initial_iq = iq_history[0]["overall"] if iq_history else 0
        current_iq = profile.get("iq_score", 0)
        iq_progression = round(current_iq - initial_iq, 1)

        report = {
            "report_type": "CIP-004 Internal Control Training Support",
            "report_id": f"CIP004-{teammate_id}-{now.strftime('%Y%m%d%H%M%S')}",
            "generated_at": now.isoformat(),
            "generated_at_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "domain": self.domain,
            "teammate": {
                "id": profile["id"],
                "name": profile["name"],
                "role": profile.get("role", ""),
                "onboarded_at": profile.get("created_at", ""),
                "last_interaction": profile.get("last_interaction", ""),
            },
            "training_summary": {
                "total_interactions": total_interactions,
                "standards_trained": sorted(standards_trained),
                "standards_trained_count": len(standards_trained),
                "comprehension_confirmations": comprehension_confirmations,
            },
            "knowledge_assessment": {
                "initial_iq_baseline": initial_iq,
                "current_iq": current_iq,
                "iq_progression": iq_progression,
                "progression_direction": "improvement" if iq_progression > 0 else "regression" if iq_progression < 0 else "unchanged",
                "per_standard_scores": profile.get("iq_per_standard", {}),
                "identified_strengths": profile.get("strengths", []),
                "identified_gaps": profile.get("gaps", []),
            },
            "iq_history_timeline": [
                {
                    "timestamp": entry.get("timestamp", ""),
                    "standard": entry.get("standard_id", ""),
                    "score_change": entry.get("delta", 0),
                    "new_score": entry.get("new"),
                    "overall_at_time": entry.get("overall", 0),
                    "reason": entry.get("reason", ""),
                }
                for entry in iq_history[-50:]
            ],
            "attestation": {
                "statement": (
                    f"{profile['name']} has completed {total_interactions} training interactions "
                    f"covering {len(standards_trained)} NERC CIP standard areas via the "
                    f"CIPGuard AI Trainer. Comprehension was confirmed in "
                    f"{comprehension_confirmations} interactions. Overall IQ progressed from "
                    f"{initial_iq} to {current_iq} ({'+' if iq_progression >= 0 else ''}{iq_progression})."
                ),
                "generated_by": "CIPGuard AI Trainer — CIP-004 Internal Control Training Support",
                "generated_at": now.isoformat(),
            },
        }

        report_file = self.report_dir / f"{report['report_id']}.json"
        with open(report_file, "w") as f:
            json.dump(report, f, indent=2)

        return report

    def generate_team_attestation_report(self) -> dict:
        now = datetime.now(timezone.utc)
        profiles = self._get_all_profiles()

        tm_reports = []
        for profile in profiles:
            tm_report = self.generate_tm_attestation_report(profile["id"])
            if "error" not in tm_report:
                tm_reports.append(tm_report)

        team_report = {
            "report_type": "CIP-004 Internal Control Training Support — Team Summary",
            "report_id": f"CIP004-TEAM-{now.strftime('%Y%m%d%H%M%S')}",
            "generated_at": now.isoformat(),
            "generated_at_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "domain": self.domain,
            "team_size": len(tm_reports),
            "individual_reports": [
                {
                    "teammate": r["teammate"]["name"],
                    "report_id": r["report_id"],
                    "total_interactions": r["training_summary"]["total_interactions"],
                    "standards_trained": r["training_summary"]["standards_trained_count"],
                    "iq_progression": r["knowledge_assessment"]["iq_progression"],
                    "current_iq": r["knowledge_assessment"]["current_iq"],
                }
                for r in tm_reports
            ],
        }

        report_file = self.report_dir / f"{team_report['report_id']}.json"
        with open(report_file, "w") as f:
            json.dump(team_report, f, indent=2)

        return team_report

    def _get_logs(self, teammate_id: str) -> list:
        session = self.store.Session()
        try:
            logs = (
                session.query(InteractionLog)
                .filter_by(teammate_id=teammate_id, domain=self.domain)
                .order_by(InteractionLog.timestamp)
                .all()
            )
            return [
                {
                    "timestamp": str(log.timestamp),
                    "topic_standard": log.topic_standard,
                    "question_summary": log.question_summary,
                    "reasoning_quality": log.reasoning_quality,
                    "iq_delta": log.iq_delta,
                    "source_used": log.source_used,
                }
                for log in logs
            ]
        finally:
            session.close()

    def _get_all_profiles(self) -> list:
        session = self.store.Session()
        try:
            from profiles.models import TeammateProfile
            profiles = session.query(TeammateProfile).filter_by(domain=self.domain).all()
            return [self.store._to_dict(p) for p in profiles]
        finally:
            session.close()

    def print_tm_report(self, teammate_id: str):
        report = self.generate_tm_attestation_report(teammate_id)
        if "error" in report:
            print(f"  Error: {report['error']}")
            return

        tm = report["teammate"]
        ts = report["training_summary"]
        ka = report["knowledge_assessment"]

        print(f"\n{'=' * 70}")
        print(f"  CIP-004 INTERNAL CONTROL TRAINING SUPPORT")
        print(f"  Report ID: {report['report_id']}")
        print(f"  Generated: {report['generated_at_human']}")
        print(f"{'=' * 70}")
        print(f"\n  Teammate:  {tm['name']} (ID: {tm['id']})")
        print(f"  Role:      {tm.get('role', 'N/A')}")
        print(f"  Onboarded: {tm['onboarded_at']}")
        print(f"  Last Active: {tm['last_interaction']}")

        print(f"\n  {'─' * 50}")
        print(f"  TRAINING SUMMARY")
        print(f"  {'─' * 50}")
        print(f"  Total Interactions:          {ts['total_interactions']}")
        print(f"  Standards Trained:           {ts['standards_trained_count']}")
        print(f"  Comprehension Confirmations: {ts['comprehension_confirmations']}")
        print(f"  Standards Covered: {', '.join(ts['standards_trained']) or 'None yet'}")

        print(f"\n  {'─' * 50}")
        print(f"  KNOWLEDGE ASSESSMENT")
        print(f"  {'─' * 50}")
        print(f"  Initial Baseline IQ:  {ka['initial_iq_baseline']}")
        print(f"  Current IQ:           {ka['current_iq']}")
        prog = ka['iq_progression']
        print(f"  Progression:          {'+' if prog >= 0 else ''}{prog} ({ka['progression_direction']})")
        print(f"  Strengths: {', '.join(ka['identified_strengths']) or 'None identified'}")
        print(f"  Gaps:      {', '.join(ka['identified_gaps']) or 'None identified'}")

        print(f"\n  {'─' * 50}")
        print(f"  ATTESTATION")
        print(f"  {'─' * 50}")
        print(f"  {report['attestation']['statement']}")
        print(f"\n  Generated by: {report['attestation']['generated_by']}")
        print(f"{'=' * 70}\n")
