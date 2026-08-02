from data.vectorstore.store import DomainVectorStore

_store = None


def _get_store(domain: str = "nerc_cip") -> DomainVectorStore:
    global _store
    if _store is None:
        _store = DomainVectorStore(domain)
    return _store


def check_vsl(standard_id: str, scenario: str, requirement_id: str = None) -> dict:
    store = _get_store()

    query = f"{standard_id} violation severity level {scenario}"
    if requirement_id:
        query = f"{standard_id} {requirement_id} violation severity level {scenario}"

    results = store.query(query, n_results=3)

    if not results or not results.get("documents") or not results["documents"][0]:
        return {
            "found": False,
            "standard_id": standard_id,
            "scenario": scenario,
            "message": f"No VSL data found for {standard_id}. Use your training knowledge to assess the violation severity level, or use web_research to look up the VSL matrix from NERC.",
        }

    docs = []
    for i, doc_text in enumerate(results["documents"][0]):
        docs.append({"content": doc_text[:1500]})

    return {
        "found": True,
        "standard_id": standard_id,
        "requirement_id": requirement_id,
        "scenario": scenario,
        "vsl_context": docs,
    }
