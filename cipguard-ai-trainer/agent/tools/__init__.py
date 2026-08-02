from config.settings import USE_SUPABASE

from agent.tools.vsl_checker import check_vsl
from agent.tools.program_evaluator import evaluate_program
from agent.tools.web_researcher import web_research

if USE_SUPABASE:
    from agent.tools.supabase_tools import (
        search_documents_supabase as search_documents,
        lookup_standard_supabase as lookup_standard,
        log_source_attribution_supabase as log_source_attribution,
        log_reasoning_entry_supabase as log_reasoning_entry,
        log_escalation_supabase as log_escalation,
    )
else:
    from agent.tools.document_search import search_documents
    from agent.tools.standard_lookup import lookup_standard
    from agent.tools.escalation_tool import log_escalation
    from agent.tools.source_attribution_tool import log_source_attribution
    from agent.tools.reasoning_journal_tool import log_reasoning_entry

TOOL_DEFINITIONS = [
    {
        "name": "document_search",
        "description": "Search the customer's ingested program documentation (policies, procedures, instructions, evidence) for information relevant to a query. Use this when the teammate asks about their organization's specific compliance practices, program documentation, or internal procedures.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What to search for in the customer's documents",
                },
                "doc_type": {
                    "type": "string",
                    "enum": [
                        "policy",
                        "program",
                        "procedure",
                        "instruction",
                        "evidence",
                        "all",
                    ],
                    "description": "Filter by document type. Use 'all' if unsure.",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "standard_lookup",
        "description": "Look up the specific text and requirements of a compliance standard requirement. Use this when you need the exact requirement language, applicability, or measures for a specific standard (e.g., CIP-007 R2).",
        "input_schema": {
            "type": "object",
            "properties": {
                "standard_id": {
                    "type": "string",
                    "description": "The standard identifier (e.g., 'CIP-007')",
                },
                "requirement_id": {
                    "type": "string",
                    "description": "The specific requirement (e.g., 'R2'). Omit to get all requirements for the standard.",
                },
            },
            "required": ["standard_id"],
        },
    },
    {
        "name": "vsl_check",
        "description": "Check the Violation Severity Level implications for a specific compliance gap or scenario. Use this when assessing potential risk exposure from a non-compliance situation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "standard_id": {"type": "string"},
                "requirement_id": {"type": "string"},
                "scenario": {
                    "type": "string",
                    "description": "Description of the gap or non-compliance scenario",
                },
            },
            "required": ["standard_id", "scenario"],
        },
    },
    {
        "name": "program_evaluate",
        "description": "Evaluate a specific aspect of the customer's compliance program against the standard requirements. Returns an efficacy assessment identifying strengths and gaps.",
        "input_schema": {
            "type": "object",
            "properties": {
                "standard_id": {"type": "string"},
                "aspect": {
                    "type": "string",
                    "description": "What aspect of the program to evaluate",
                },
            },
            "required": ["standard_id", "aspect"],
        },
    },
    {
        "name": "web_research",
        "description": "Research current information from regulatory sources (NERC, FERC, etc.). Use when the answer requires recent enforcement actions, guidance updates, lessons learned, or other information not in the knowledge base.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "What to research"},
                "source_type": {
                    "type": "string",
                    "enum": ["nerc", "ferc", "general"],
                    "description": "Where to focus the search",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "log_escalation",
        "description": "Log an escalation when a question cannot be resolved through Tier 1 (resource data) and Tier 2 (web research). This routes the question to the teammate's designated escalation contact. Only use this AFTER exhausting document_search, standard_lookup, and web_research.",
        "input_schema": {
            "type": "object",
            "properties": {
                "teammate_id": {
                    "type": "string",
                    "description": "The teammate's ID",
                },
                "question": {
                    "type": "string",
                    "description": "The unresolved question",
                },
                "tier1_result": {
                    "type": "string",
                    "description": "Summary of what Tier 1 (resource data search) found or why it was insufficient",
                },
                "tier2_result": {
                    "type": "string",
                    "description": "Summary of what Tier 2 (web research) found or why it was insufficient",
                },
                "escalation_contact": {
                    "type": "string",
                    "description": "The designated escalation contact's name",
                },
            },
            "required": ["teammate_id", "question", "tier1_result", "tier2_result", "escalation_contact"],
        },
    },
    {
        "name": "log_source_attribution",
        "description": "Log which knowledge source answered a question. Call this AFTER answering every substantive question to record the source for compliance auditability. Source types: 'llm_parametric', 'rag_document', 'standard_lookup', 'web_research', 'cf6_deviation'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "teammate_id": {
                    "type": "string",
                    "description": "The teammate's ID",
                },
                "question_summary": {
                    "type": "string",
                    "description": "Brief summary of the question asked",
                },
                "source_type": {
                    "type": "string",
                    "enum": ["llm_parametric", "rag_document", "standard_lookup", "web_research", "cf6_deviation"],
                    "description": "Which knowledge source provided the answer",
                },
                "source_detail": {
                    "type": "string",
                    "description": "Specific detail about the source (e.g., document name, URL, standard section)",
                },
                "standard_cited": {
                    "type": "string",
                    "description": "The specific standard requirement cited in the answer (e.g., 'CIP-007 R2')",
                },
                "tool_used": {
                    "type": "string",
                    "description": "Name of the tool used, if any (e.g., 'document_search', 'standard_lookup')",
                },
                "confidence": {
                    "type": "number",
                    "description": "Confidence level in the answer (0.0 to 1.0)",
                },
            },
            "required": ["teammate_id", "question_summary", "source_type", "source_detail"],
        },
    },
    {
        "name": "log_reasoning_entry",
        "description": "Log a teammate's reasoning choice to the Reasoning Journal. Call this AFTER CF3 interprets a teammate's option selection to persist longitudinal reasoning data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "teammate_id": {
                    "type": "string",
                    "description": "The teammate's ID",
                },
                "standard_id": {
                    "type": "string",
                    "description": "The standard being discussed (e.g., 'CIP-007')",
                },
                "requirement_id": {
                    "type": "string",
                    "description": "The specific requirement (e.g., 'R2')",
                },
                "options_presented": {
                    "type": "string",
                    "description": "JSON array of the options presented (e.g., '[\"Option A\", \"Option B\"]')",
                },
                "option_chosen": {
                    "type": "string",
                    "description": "Which option the teammate selected",
                },
                "reasoning_given": {
                    "type": "string",
                    "description": "The teammate's stated reasoning for their choice",
                },
                "ai_assessment": {
                    "type": "string",
                    "description": "The AI's assessment of the reasoning quality",
                },
                "reasoning_depth": {
                    "type": "string",
                    "enum": ["surface", "adequate", "thorough", "expert"],
                    "description": "Depth classification of the reasoning",
                },
                "cross_standard_awareness": {
                    "type": "boolean",
                    "description": "Whether the reasoning showed awareness of cross-standard relationships",
                },
                "missed_implications": {
                    "type": "string",
                    "description": "JSON array of implications the teammate missed (e.g., '[\"VSL exposure\", \"CIP-010 interaction\"]')",
                },
            },
            "required": ["teammate_id", "standard_id", "requirement_id", "options_presented", "option_chosen", "reasoning_given", "ai_assessment", "reasoning_depth"],
        },
    },
]

TOOL_DISPATCH = {
    "document_search": search_documents,
    "standard_lookup": lookup_standard,
    "vsl_check": check_vsl,
    "program_evaluate": evaluate_program,
    "web_research": web_research,
    "log_escalation": log_escalation,
    "log_source_attribution": log_source_attribution,
    "log_reasoning_entry": log_reasoning_entry,
}


def execute_tool(tool_name: str, tool_input: dict) -> dict:
    handler = TOOL_DISPATCH.get(tool_name)
    if not handler:
        return {"error": f"Unknown tool: {tool_name}"}
    try:
        return handler(**tool_input)
    except Exception as e:
        return {"error": f"Tool execution failed: {str(e)}"}
