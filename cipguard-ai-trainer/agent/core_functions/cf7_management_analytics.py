"""
CF7 — Management Analytics Layer

Produces management-level metrics reports from read-only snapshots of
individual TM data. Supports drill-down into specific gap areas.

HARD CONSTRAINT: This module has READ-ONLY access to TM profiles and
interaction logs. It NEVER writes to, modifies, or influences any
individual TM's baseline, IQ score, reasoning profile, or interaction
history. Cross-TM correlations are surfaced for management visibility
only — they never feed back into individual assessments.
"""

from datetime import datetime, timezone
from profiles.teammate_store import TeammateStore
from profiles.models import InteractionLog
from sqlalchemy import func


class ManagementAnalytics:
    def __init__(self, domain: str = "nerc_cip"):
        self.domain = domain
        self.store = TeammateStore()

    def _get_all_tm_profiles(self) -> list:
        session = self.store.Session()
        try:
            from profiles.models import TeammateProfile
            profiles = session.query(TeammateProfile).filter_by(domain=self.domain).all()
            return [self.store._to_dict(p) for p in profiles]
        finally:
            session.close()

    def _get_interaction_logs(self, teammate_id: str = None) -> list:
        session = self.store.Session()
        try:
            query = session.query(InteractionLog).filter_by(domain=self.domain)
            if teammate_id:
                query = query.filter_by(teammate_id=teammate_id)
            logs = query.order_by(InteractionLog.timestamp.desc()).all()
            return [
                {
                    "teammate_id": log.teammate_id,
                    "timestamp": str(log.timestamp),
                    "topic_standard": log.topic_standard,
                    "question_summary": log.question_summary,
                    "option_chosen": log.option_chosen,
                    "reasoning_quality": log.reasoning_quality,
                    "iq_delta": log.iq_delta,
                    "source_used": log.source_used,
                }
                for log in logs
            ]
        finally:
            session.close()

    def generate_team_metrics_report(self) -> dict:
        now = datetime.now(timezone.utc)
        profiles = self._get_all_tm_profiles()

        if not profiles:
            return {
                "report_generated_at": now.isoformat(),
                "report_generated_at_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
                "domain": self.domain,
                "team_size": 0,
                "message": "No teammates onboarded yet.",
            }

        team_size = len(profiles)
        baselined_count = sum(1 for p in profiles if p.get("interaction_count", 0) > 0)

        all_standards = set()
        standard_scores = {}
        standard_gap_tms = {}

        for profile in profiles:
            per_std = profile.get("iq_per_standard", {})
            for std_id, score in per_std.items():
                all_standards.add(std_id)
                if std_id not in standard_scores:
                    standard_scores[std_id] = []
                    standard_gap_tms[std_id] = []
                standard_scores[std_id].append(score)
                if score < 40:
                    standard_gap_tms[std_id].append(profile["id"])

        standard_averages = {}
        for std_id, scores in standard_scores.items():
            standard_averages[std_id] = {
                "average_iq": round(sum(scores) / len(scores), 1),
                "tm_count_assessed": len(scores),
                "tm_count_below_developing": len(standard_gap_tms.get(std_id, [])),
            }

        overall_scores = [p.get("iq_score", 0) for p in profiles if p.get("iq_score", 0) > 0]
        team_average_iq = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else 0

        gap_standards = sorted(
            [
                {"standard_id": std_id, **data}
                for std_id, data in standard_averages.items()
                if data["tm_count_below_developing"] > 0
            ],
            key=lambda x: x["tm_count_below_developing"],
            reverse=True,
        )

        strength_standards = sorted(
            [
                {"standard_id": std_id, **data}
                for std_id, data in standard_averages.items()
                if data["average_iq"] >= 70
            ],
            key=lambda x: x["average_iq"],
            reverse=True,
        )

        tm_summaries = []
        for profile in profiles:
            tm_summaries.append({
                "teammate_id": profile["id"],
                "name": profile["name"],
                "overall_iq": profile.get("iq_score", 0),
                "interaction_count": profile.get("interaction_count", 0),
                "strengths": profile.get("strengths", []),
                "gaps": profile.get("gaps", []),
                "last_interaction": profile.get("last_interaction", "Never"),
            })

        return {
            "report_generated_at": now.isoformat(),
            "report_generated_at_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "domain": self.domain,
            "team_size": team_size,
            "teammates_baselined": baselined_count,
            "team_average_iq": team_average_iq,
            "standards_assessed": len(all_standards),
            "team_gap_areas": gap_standards,
            "team_strength_areas": strength_standards,
            "per_standard_averages": standard_averages,
            "teammate_summaries": tm_summaries,
        }

    def get_gap_drilldown(self, standard_id: str) -> dict:
        """
        Management drill-down into a specific gap area.
        Shows which TMs are struggling, the types of questions that
        revealed the gap, and the standard's requirements context.
        READ-ONLY — no TM data is modified.
        """
        profiles = self._get_all_tm_profiles()
        all_logs = self._get_interaction_logs()

        tm_detail = []
        for profile in profiles:
            per_std = profile.get("iq_per_standard", {})
            score = per_std.get(standard_id)
            if score is None:
                continue

            tm_logs = [
                log for log in all_logs
                if log["teammate_id"] == profile["id"]
                and log.get("topic_standard") == standard_id
            ]

            tm_detail.append({
                "teammate_id": profile["id"],
                "name": profile["name"],
                "score_for_standard": score,
                "level": self._score_to_level(score),
                "interaction_count_on_standard": len(tm_logs),
                "recent_interactions": tm_logs[:5],
            })

        tm_detail.sort(key=lambda x: x["score_for_standard"])

        scores = [t["score_for_standard"] for t in tm_detail]
        avg = round(sum(scores) / len(scores), 1) if scores else 0
        below_developing = sum(1 for s in scores if s < 40)

        return {
            "standard_id": standard_id,
            "team_average_for_standard": avg,
            "total_tms_assessed": len(tm_detail),
            "tms_below_developing": below_developing,
            "tms_at_or_above_proficient": sum(1 for s in scores if s >= 51),
            "teammate_details": tm_detail,
            "note": "This drill-down is read-only. No individual TM data has been modified.",
        }

    def _score_to_level(self, score: float) -> str:
        if score <= 25:
            return "Foundational"
        if score <= 50:
            return "Developing"
        if score <= 75:
            return "Proficient"
        return "Expert"

    def print_report(self):
        report = self.generate_team_metrics_report()

        print(f"\n{'=' * 70}")
        print(f"  MANAGEMENT METRICS REPORT — {report['domain']}")
        print(f"  Generated: {report.get('report_generated_at_human', '')}")
        print(f"{'=' * 70}")

        if report["team_size"] == 0:
            print("\n  No teammates onboarded yet.\n")
            return

        print(f"\n  Team Size:            {report['team_size']}")
        print(f"  Teammates Baselined:  {report['teammates_baselined']}")
        print(f"  Team Average IQ:      {report['team_average_iq']}")
        print(f"  Standards Assessed:   {report['standards_assessed']}")

        gap_areas = report.get("team_gap_areas", [])
        if gap_areas:
            print(f"\n  {'─' * 50}")
            print(f"  TEAM GAP AREAS (standards where TMs fall below Developing)")
            print(f"  {'─' * 50}")
            for gap in gap_areas:
                print(f"    {gap['standard_id']}: avg IQ {gap['average_iq']}, "
                      f"{gap['tm_count_below_developing']}/{gap['tm_count_assessed']} TMs below Developing")

        strength_areas = report.get("team_strength_areas", [])
        if strength_areas:
            print(f"\n  {'─' * 50}")
            print(f"  TEAM STRENGTHS (standards averaging Proficient+)")
            print(f"  {'─' * 50}")
            for s in strength_areas:
                print(f"    {s['standard_id']}: avg IQ {s['average_iq']}")

        print(f"\n  {'─' * 50}")
        print(f"  INDIVIDUAL TEAMMATE SUMMARY")
        print(f"  {'─' * 50}")
        for tm in report.get("teammate_summaries", []):
            gaps_str = ", ".join(tm["gaps"]) if tm["gaps"] else "None identified"
            print(f"    {tm['name']} (ID: {tm['teammate_id']})")
            print(f"      IQ: {tm['overall_iq']}  |  Interactions: {tm['interaction_count']}  |  Gaps: {gaps_str}")

        print(f"\n  NOTE: This report is generated from read-only snapshots of")
        print(f"  individual TM data. No TM baseline or score has been modified.")
        print(f"{'=' * 70}\n")

    def print_drilldown(self, standard_id: str):
        detail = self.get_gap_drilldown(standard_id)

        print(f"\n{'=' * 70}")
        print(f"  GAP DRILL-DOWN — {detail['standard_id']}")
        print(f"{'=' * 70}")
        print(f"  Team Average:           {detail['team_average_for_standard']}")
        print(f"  TMs Assessed:           {detail['total_tms_assessed']}")
        print(f"  TMs Below Developing:   {detail['tms_below_developing']}")
        print(f"  TMs At/Above Proficient: {detail['tms_at_or_above_proficient']}")

        print(f"\n  {'─' * 50}")
        print(f"  PER-TEAMMATE DETAIL (sorted by score, lowest first)")
        print(f"  {'─' * 50}")
        for tm in detail.get("teammate_details", []):
            print(f"\n    {tm['name']} — Score: {tm['score_for_standard']} ({tm['level']})")
            print(f"    Interactions on this standard: {tm['interaction_count_on_standard']}")
            if tm.get("recent_interactions"):
                print(f"    Recent activity:")
                for log in tm["recent_interactions"]:
                    print(f"      [{log.get('timestamp', '?')}] {log.get('question_summary', 'N/A')}")

        print(f"\n  {detail['note']}")
        print(f"{'=' * 70}\n")
