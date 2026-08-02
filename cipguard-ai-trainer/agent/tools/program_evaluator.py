from data.vectorstore.store import DomainVectorStore

_store = None


def _get_store(domain: str = "nerc_cip") -> DomainVectorStore:
    global _store
    if _store is None:
        _store = DomainVectorStore(domain)
    return _store


def evaluate_program(standard_id: str, aspect: str) -> dict:
    store = _get_store()

    query = f"{standard_id} {aspect} program policy procedure evidence"
    results = store.query(query, n_results=5)

    if not results or not results.get("documents") or not results["documents"][0]:
        return {
            "found": False,
            "standard_id": standard_id,
            "aspect": aspect,
            "message": f"No program documentation found related to {standard_id} and '{aspect}'. The customer may not have provided documentation for this area yet.",
        }

    docs = []
    for i, doc_text in enumerate(results["documents"][0]):
        metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
        docs.append(
            {
                "content": doc_text[:1500],
                "source": metadata.get("source_file", "Unknown"),
                "type": metadata.get("document_type", "unclassified"),
            }
        )

    return {
        "found": True,
        "standard_id": standard_id,
        "aspect": aspect,
        "program_documents": docs,
        "instruction": "Evaluate these documents against the standard requirements. Identify strengths, gaps, and potential VSL exposure.",
    }
