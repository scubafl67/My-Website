"""Tool wrapper for Rec 3 — Source Attribution Logging."""

from agent.core_functions.source_attribution import SourceAttributionLogger

_logger = SourceAttributionLogger()


def log_source_attribution(
    teammate_id: str,
    question_summary: str,
    source_type: str,
    source_detail: str,
    standard_cited: str = "",
    tool_used: str = "",
    confidence: float = 1.0,
) -> dict:
    return _logger.log_attribution(
        teammate_id=teammate_id,
        question_summary=question_summary,
        source_type=source_type,
        source_detail=source_detail,
        standard_cited=standard_cited,
        tool_used=tool_used,
        confidence=confidence,
    )
