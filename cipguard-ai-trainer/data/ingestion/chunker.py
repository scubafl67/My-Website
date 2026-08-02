try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
except ImportError:
    RecursiveCharacterTextSplitter = None


class DomainChunker:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        if RecursiveCharacterTextSplitter is None:
            raise ImportError("langchain not installed. Run: pip install langchain")
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " "],
        )

    def chunk_documents(self, documents: list) -> list:
        return self.splitter.split_documents(documents)

    def chunk_crawled_docs(self, crawled_docs: list) -> list:
        from langchain.schema import Document

        lc_docs = []
        for doc in crawled_docs:
            content = doc.get("markdown", doc.get("content", ""))
            if not content:
                continue
            lc_docs.append(
                Document(
                    page_content=content,
                    metadata={
                        "source": doc.get("url", doc.get("_source_url", "")),
                        "source_file": doc.get("title", "web_crawl"),
                        "document_type": "standard",
                        "crawl_timestamp": doc.get("_crawl_timestamp", ""),
                        "source_description": doc.get("_source_description", ""),
                    },
                )
            )
        return self.splitter.split_documents(lc_docs)
