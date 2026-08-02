from agent.core_functions.escalation_handler import EscalationHandler

_handler = None


def _get_handler(domain: str = "nerc_cip") -> EscalationHandler:
    global _handler
    if _handler is None:
        _handler = EscalationHandler(domain)
    return _handler


def log_escalation(
    teammate_id: str,
    question: str,
    tier1_result: str,
    tier2_result: str,
    escalation_contact: str,
) -> dict:
    handler = _get_handler()
    entry = handler.log_escalation(
        teammate_id=teammate_id,
        question=question,
        tier1_result=tier1_result,
        tier2_result=tier2_result,
        escalation_contact=escalation_contact,
    )
    return {
        "escalation_id": entry["escalation_id"],
        "status": "logged",
        "escalation_contact": escalation_contact,
        "message": (
            f"Escalation logged as {entry['escalation_id']}. "
            f"The question has been flagged for review by {escalation_contact}."
        ),
    }
