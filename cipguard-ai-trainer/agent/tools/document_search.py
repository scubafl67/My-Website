from data.vectorstore.store import DomainVectorStore

_store = None


def _get_store(domain: str = "nerc_cip") -> DomainVectorStore:
    global _store
    if _store is None:
        _store = DomainVectorStore(domain)
    return _store


def search_documents(query: str, doc_type: str = "all") -> dict:
    store = _get_store()
    filters = None
    if doc_type and doc_type != "all":
        filters = {"document_type": doc_type}

    results = store.query(query, n_results=5, filters=filters)

    if not results or not results.get("documents") or not results["documents"][0]:
        return {
            "found": False,
            "message": "No matching documents found in the customer's program documentation.",
        }

    docs = []
    for i, doc_text in enumerate(results["documents"][0]):
        metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
        docs.append(
            {
                "content": doc_text[:1500],
                "source": metadata.get("source_file", "Unknown"),
                "type": metadata.get("document_type", "unclassified"),
                "relevance_rank": i + 1,
            }
        )

    return {"found": True, "results": docs, "total": len(docs)}
