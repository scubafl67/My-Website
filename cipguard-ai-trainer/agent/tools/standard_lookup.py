from data.vectorstore.store import DomainVectorStore

_store = None


def _get_store(domain: str = "nerc_cip") -> DomainVectorStore:
    global _store
    if _store is None:
        _store = DomainVectorStore(domain)
    return _store


def lookup_standard(standard_id: str, requirement_id: str = None) -> dict:
    store = _get_store()

    query = f"{standard_id}"
    if requirement_id:
        query += f" {requirement_id}"
    query += " requirement text applicability measures"

    results = store.query(query, n_results=5, filters={"standard_id": standard_id} if False else None)

    if not results or not results.get("documents") or not results["documents"][0]:
        return {
            "found": False,
            "standard_id": standard_id,
            "requirement_id": requirement_id,
            "message": f"No ingested data found for {standard_id}. The standard may not have been crawled yet. Use web_research to look it up from NERC directly.",
        }

    docs = []
    for i, doc_text in enumerate(results["documents"][0]):
        metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
        docs.append(
            {
                "content": doc_text[:2000],
                "source": metadata.get("source_file", metadata.get("source", "NERC Standards Database")),
            }
        )

    return {
        "found": True,
        "standard_id": standard_id,
        "requirement_id": requirement_id,
        "results": docs,
    }
