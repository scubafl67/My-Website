from profiles.teammate_store import TeammateStore
from datetime import datetime, timezone


class IQTracker:
    def __init__(self, store: TeammateStore = None):
        self.store = store or TeammateStore()

    def update_iq(self, teammate_id: str, standard_id: str, delta: float, reason: str) -> dict:
        profile = self.store.get(teammate_id)
        if not profile:
            return {}

        iq_per_standard = profile.get("iq_per_standard", {})
        current = iq_per_standard.get(standard_id, 50.0)
        new_score = max(0, min(100, current + delta))
        iq_per_standard[standard_id] = new_score

        all_scores = list(iq_per_standard.values())
        overall_iq = sum(all_scores) / len(all_scores) if all_scores else 0.0

        history = profile.get("iq_history", [])
        history.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "standard_id": standard_id,
            "previous": current,
            "new": new_score,
            "delta": delta,
            "reason": reason,
            "overall": overall_iq,
        })

        strengths = [sid for sid, score in iq_per_standard.items() if score >= 70]
        gaps = [sid for sid, score in iq_per_standard.items() if score < 40]

        return self.store.update(
            teammate_id,
            iq_score=overall_iq,
            iq_per_standard=iq_per_standard,
            iq_history=history[-100:],
            strengths=strengths,
            gaps=gaps,
        )

    def get_iq_summary(self, teammate_id: str) -> dict:
        profile = self.store.get(teammate_id)
        if not profile:
            return {}

        iq_per_standard = profile.get("iq_per_standard", {})
        return {
            "overall": profile.get("iq_score", 0),
            "per_standard": iq_per_standard,
            "strengths": profile.get("strengths", []),
            "gaps": profile.get("gaps", []),
            "interaction_count": profile.get("interaction_count", 0),
        }
