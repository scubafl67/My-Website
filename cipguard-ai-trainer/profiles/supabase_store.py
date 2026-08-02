"""
Supabase-backed TeammateStore — drop-in replacement for the SQLAlchemy version.
Uses Supabase service-role client to read/write training_profiles and
training_interactions tables, keyed by the user's auth.users UUID.
"""

from datetime import datetime, timezone

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None


class SupabaseTeammateStore:
    def __init__(self, supabase_url: str, supabase_service_key: str):
        if create_client is None:
            raise ImportError("supabase-py not installed. Run: pip install supabase")
        self.sb: Client = create_client(supabase_url, supabase_service_key)

    def get_or_create(self, teammate_id: str, name: str = None, domain: str = "nerc_cip") -> dict:
        row = (
            self.sb.table("training_profiles")
            .select("*")
            .eq("user_id", teammate_id)
            .maybe_single()
            .execute()
        )
        if row.data:
            return self._to_dict(row.data)

        new_profile = {
            "user_id": teammate_id,
            "domain": domain,
            "iq_score": 0.0,
            "iq_per_standard": {},
            "iq_history": [],
            "strengths": [],
            "gaps": [],
            "interaction_count": 0,
            "pattern_data": {},
            "baseline_completed": 0,
            "escalation_contact": "",
            "confidence_per_standard": {},
        }
        result = self.sb.table("training_profiles").insert(new_profile).execute()
        return self._to_dict(result.data[0])

    def get(self, teammate_id: str) -> dict:
        row = (
            self.sb.table("training_profiles")
            .select("*")
            .eq("user_id", teammate_id)
            .maybe_single()
            .execute()
        )
        if not row.data:
            return {}
        return self._to_dict(row.data)

    def update(self, teammate_id: str, **kwargs) -> dict:
        allowed = {
            "iq_score", "iq_per_standard", "iq_history", "strengths", "gaps",
            "interaction_count", "pattern_data", "baseline_completed",
            "escalation_contact", "confidence_per_standard", "domain",
        }
        payload = {k: v for k, v in kwargs.items() if k in allowed}
        if not payload:
            return self.get(teammate_id)
        result = (
            self.sb.table("training_profiles")
            .update(payload)
            .eq("user_id", teammate_id)
            .execute()
        )
        if result.data:
            return self._to_dict(result.data[0])
        return self.get(teammate_id)

    def increment_interaction(self, teammate_id: str) -> None:
        profile = self.get(teammate_id)
        if profile:
            new_count = profile.get("interaction_count", 0) + 1
            self.sb.table("training_profiles").update(
                {"interaction_count": new_count}
            ).eq("user_id", teammate_id).execute()

    def log_interaction(self, teammate_id: str, domain: str, **kwargs) -> None:
        row = {"user_id": teammate_id, "domain": domain}
        allowed = {
            "topic_standard", "question_summary", "option_chosen",
            "reasoning_quality", "iq_delta", "source_used", "source_type",
            "source_detail", "standard_cited", "reasoning_depth",
            "cross_standard_awareness", "missed_implications",
            "comprehension_confirmed", "comprehension_attempts",
        }
        row.update({k: v for k, v in kwargs.items() if k in allowed})
        self.sb.table("training_interactions").insert(row).execute()

    def get_user_name(self, teammate_id: str) -> str:
        row = (
            self.sb.table("profiles")
            .select("full_name")
            .eq("id", teammate_id)
            .maybe_single()
            .execute()
        )
        if row.data and row.data.get("full_name"):
            return row.data["full_name"]
        return teammate_id

    def save_conversation_turn(self, user_id: str, role: str, content: str) -> None:
        self.sb.table("training_conversations").insert({
            "user_id": user_id,
            "role": role,
            "content": content,
        }).execute()

    def load_conversation_history(self, user_id: str, limit: int = 50) -> list:
        result = (
            self.sb.table("training_conversations")
            .select("role, content")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return [{"role": r["role"], "content": r["content"]} for r in (result.data or [])]

    def clear_conversation_history(self, user_id: str) -> None:
        self.sb.table("training_conversations").delete().eq("user_id", user_id).execute()

    def _to_dict(self, row: dict) -> dict:
        return {
            "id": row["user_id"],
            "name": self.get_user_name(row["user_id"]),
            "role": "",
            "domain": row.get("domain", "nerc_cip"),
            "iq_score": row.get("iq_score", 0.0),
            "iq_per_standard": row.get("iq_per_standard") or {},
            "iq_history": row.get("iq_history") or [],
            "strengths": row.get("strengths") or [],
            "gaps": row.get("gaps") or [],
            "interaction_count": row.get("interaction_count", 0),
            "pattern_data": row.get("pattern_data") or {},
            "baseline_completed": row.get("baseline_completed", 0),
            "escalation_contact": row.get("escalation_contact", ""),
            "confidence_per_standard": row.get("confidence_per_standard") or {},
            "created_at": row.get("created_at", ""),
            "last_interaction": row.get("last_interaction", ""),
        }
