"""
Supabase-backed tool implementations that unify data sources with the React app.
- document_search  → queries nerc_chunks via vector similarity (same as query-nerc edge fn)
- standard_lookup  → queries cip_standards + nerc_documents tables
- log_source_attribution → writes to training_source_logs
- log_reasoning_entry    → writes to training_reasoning_logs
- log_escalation         → writes to training_escalations
"""

import json
import os

_sb = None


def _get_sb():
    global _sb
    if _sb is None:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        _sb = create_client(url, key)
    return _sb


def search_documents_supabase(query: str, doc_type: str = "all") -> dict:
    sb = _get_sb()
    try:
        embed_result = sb.functions.invoke("embed-pending", invoke_options={
            "body": {"action": "embed_query", "text": query}
        })
    except Exception:
        pass

    try:
        result = sb.rpc("match_nerc_chunks", {
            "query_embedding": _embed_text(query),
            "match_count": 5,
        }).execute()
    except Exception:
        return _fallback_text_search(sb, query, doc_type)

    if not result.data:
        return _fallback_text_search(sb, query, doc_type)

    docs = []
    for i, chunk in enumerate(result.data):
        docs.append({
            "content": (chunk.get("content") or "")[:1500],
            "source": chunk.get("title") or chunk.get("url") or "NERC Document",
            "type": doc_type if doc_type != "all" else "nerc_document",
            "relevance_rank": i + 1,
        })

    return {"found": True, "results": docs, "total": len(docs)}


def _fallback_text_search(sb, query: str, doc_type: str) -> dict:
    keywords = query.split()[:3]
    search_term = " & ".join(keywords)
    try:
        result = (
            sb.table("nerc_chunks")
            .select("content, title, url")
            .text_search("content", search_term)
            .limit(5)
            .execute()
        )
    except Exception:
        result = (
            sb.table("nerc_chunks")
            .select("content, title, url")
            .ilike("content", f"%{query[:50]}%")
            .limit(5)
            .execute()
        )

    if not result.data:
        return {
            "found": False,
            "message": "No matching documents found. Try web_research for current NERC/FERC information.",
        }

    docs = []
    for i, chunk in enumerate(result.data):
        docs.append({
            "content": (chunk.get("content") or "")[:1500],
            "source": chunk.get("title") or chunk.get("url") or "NERC Document",
            "type": doc_type if doc_type != "all" else "nerc_document",
            "relevance_rank": i + 1,
        })
    return {"found": True, "results": docs, "total": len(docs)}


def _embed_text(text: str) -> list:
    import httpx
    sb = _get_sb()
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    resp = httpx.post(
        f"{url}/functions/v1/embed-pending",
        json={"action": "embed_query", "text": text},
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        timeout=30,
    )
    if resp.status_code == 200:
        data = resp.json()
        if "embedding" in data:
            return data["embedding"]
    raise RuntimeError("Embedding failed")


def lookup_standard_supabase(standard_id: str, requirement_id: str = None) -> dict:
    sb = _get_sb()
    result = (
        sb.table("cip_standards")
        .select("id, title, description, requirements, status")
        .eq("id", standard_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        return {
            "found": False,
            "standard_id": standard_id,
            "requirement_id": requirement_id,
            "message": f"Standard {standard_id} not found in the database.",
        }

    standard = result.data
    doc_result = (
        sb.table("nerc_chunks")
        .select("content, title, url")
        .ilike("content", f"%{standard_id}%")
        .limit(5)
        .execute()
    )

    docs = []
    for chunk in (doc_result.data or []):
        content = chunk.get("content", "")
        if requirement_id and requirement_id.upper() not in content.upper():
            continue
        docs.append({
            "content": content[:2000],
            "source": chunk.get("title") or chunk.get("url") or "NERC Standards Database",
        })

    return {
        "found": True,
        "standard_id": standard_id,
        "requirement_id": requirement_id,
        "standard_info": {
            "title": standard.get("title", ""),
            "description": standard.get("description", ""),
            "requirements": standard.get("requirements", []),
            "status": standard.get("status", ""),
        },
        "results": docs,
    }


def log_source_attribution_supabase(
    teammate_id: str,
    question_summary: str,
    source_type: str,
    source_detail: str,
    standard_cited: str = "",
    tool_used: str = "",
    confidence: float = 0.0,
) -> dict:
    sb = _get_sb()
    sb.table("training_source_logs").insert({
        "user_id": teammate_id,
        "question_summary": question_summary,
        "source_type": source_type,
        "source_detail": source_detail,
        "standard_cited": standard_cited,
        "tool_used": tool_used,
        "confidence": confidence,
    }).execute()
    return {"logged": True, "source_type": source_type}


def log_reasoning_entry_supabase(
    teammate_id: str,
    standard_id: str,
    requirement_id: str,
    options_presented: str,
    option_chosen: str,
    reasoning_given: str,
    ai_assessment: str,
    reasoning_depth: str,
    cross_standard_awareness: bool = False,
    missed_implications: str = "[]",
) -> dict:
    sb = _get_sb()
    try:
        opts = json.loads(options_presented) if isinstance(options_presented, str) else options_presented
    except (json.JSONDecodeError, TypeError):
        opts = [options_presented]
    try:
        missed = json.loads(missed_implications) if isinstance(missed_implications, str) else missed_implications
    except (json.JSONDecodeError, TypeError):
        missed = []

    sb.table("training_reasoning_logs").insert({
        "user_id": teammate_id,
        "standard_id": standard_id,
        "requirement_id": requirement_id or "",
        "options_presented": opts,
        "option_chosen": option_chosen,
        "reasoning_given": reasoning_given,
        "ai_assessment": ai_assessment,
        "reasoning_depth": reasoning_depth,
        "cross_standard_awareness": cross_standard_awareness,
        "missed_implications": missed,
    }).execute()
    return {"logged": True, "standard_id": standard_id}


def log_escalation_supabase(
    teammate_id: str,
    question: str,
    tier1_result: str,
    tier2_result: str,
    escalation_contact: str,
) -> dict:
    sb = _get_sb()
    sb.table("training_escalations").insert({
        "user_id": teammate_id,
        "question": question,
        "tier1_result": tier1_result,
        "tier2_result": tier2_result,
        "escalation_contact": escalation_contact,
        "status": "pending",
    }).execute()
    return {
        "escalated": True,
        "escalation_contact": escalation_contact,
        "message": f"Question escalated to {escalation_contact}. They will be notified.",
    }
