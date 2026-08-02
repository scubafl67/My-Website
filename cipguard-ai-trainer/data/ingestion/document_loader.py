from pathlib import Path

try:
    from langchain_community.document_loaders import (
        PyPDFLoader,
        Docx2txtLoader,
        TextLoader,
        UnstructuredHTMLLoader,
    )
except ImportError:
    PyPDFLoader = None
    Docx2txtLoader = None
    TextLoader = None
    UnstructuredHTMLLoader = None


class CustomerDocumentLoader:
    LOADER_MAP = {}

    def __init__(self):
        if PyPDFLoader:
            self.LOADER_MAP = {
                ".pdf": PyPDFLoader,
                ".docx": Docx2txtLoader,
                ".txt": TextLoader,
                ".html": UnstructuredHTMLLoader,
            }

    def load_directory(self, dir_path: str) -> list:
        if not self.LOADER_MAP:
            raise ImportError(
                "langchain-community not installed. Run: pip install langchain-community"
            )

        documents = []
        for file_path in Path(dir_path).rglob("*"):
            if file_path.is_dir():
                continue
            suffix = file_path.suffix.lower()
            loader_cls = self.LOADER_MAP.get(suffix)
            if loader_cls:
                try:
                    loader = loader_cls(str(file_path))
                    docs = loader.load()
                    for doc in docs:
                        doc.metadata["source_file"] = file_path.name
                        doc.metadata["document_type"] = self._classify_doc_type(
                            file_path.name
                        )
                    documents.extend(docs)
                    print(f"  Loaded: {file_path.name} ({len(docs)} chunks)")
                except Exception as e:
                    print(f"  Error loading {file_path.name}: {e}")
        return documents

    def _classify_doc_type(self, filename: str) -> str:
        lower = filename.lower()
        if "policy" in lower:
            return "policy"
        if "program" in lower:
            return "program"
        if "procedure" in lower:
            return "procedure"
        if "instruction" in lower or "work_inst" in lower:
            return "instruction"
        if "evidence" in lower or "log" in lower or "attestation" in lower:
            return "evidence"
        return "unclassified"
