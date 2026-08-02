from config.settings import VECTORSTORE_DIR

try:
    import chromadb
    from chromadb.utils import embedding_functions
except ImportError:
    chromadb = None


class DomainVectorStore:
    def __init__(self, domain_name: str, persist_dir: str = None):
        if chromadb is None:
            raise ImportError("chromadb not installed. Run: pip install chromadb")
        self.client = chromadb.PersistentClient(path=persist_dir or VECTORSTORE_DIR)
        self.embed_fn = embedding_functions.DefaultEmbeddingFunction()
        self.collection = self.client.get_or_create_collection(
            name=f"{domain_name}_knowledge",
            embedding_function=self.embed_fn,
        )

    def add_documents(self, chunks: list) -> int:
        if not chunks:
            return 0

        existing_count = self.collection.count()

        documents = [c.page_content for c in chunks]
        metadatas = [c.metadata for c in chunks]
        ids = [f"doc_{existing_count + i}" for i in range(len(chunks))]

        batch_size = 100
        added = 0
        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i : i + batch_size]
            batch_meta = metadatas[i : i + batch_size]
            batch_ids = ids[i : i + batch_size]
            self.collection.add(
                documents=batch_docs, metadatas=batch_meta, ids=batch_ids
            )
            added += len(batch_docs)

        return added

    def query(self, query_text: str, n_results: int = 5, filters: dict = None) -> dict:
        params = {"query_texts": [query_text], "n_results": n_results}
        if filters:
            params["where"] = filters
        try:
            return self.collection.query(**params)
        except Exception:
            return {"documents": [[]], "metadatas": [[]]}

    def count(self) -> int:
        return self.collection.count()

    def clear(self) -> None:
        self.client.delete_collection(self.collection.name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection.name,
            embedding_function=self.embed_fn,
        )
