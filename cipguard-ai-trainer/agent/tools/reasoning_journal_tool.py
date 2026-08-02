"""Tool wrapper for Rec 5 — Teammate Reasoning Journal."""

import json
from agent.core_functions.reasoning_journal import ReasoningJournal

_journal = ReasoningJournal()


def log_reasoning_entry(
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
    opts = json.loads(options_presented) if isinstance(options_presented, str) else options_presented
    missed = json.loads(missed_implications) if isinstance(missed_implications, str) else missed_implications

    return _journal.record_entry(
        teammate_id=teammate_id,
        standard_id=standard_id,
        requirement_id=requirement_id,
        options_presented=opts,
        option_chosen=option_chosen,
        reasoning_given=reasoning_given,
        ai_assessment=ai_assessment,
        reasoning_depth=reasoning_depth,
        cross_standard_awareness=cross_standard_awareness,
        missed_implications=missed,
    )
