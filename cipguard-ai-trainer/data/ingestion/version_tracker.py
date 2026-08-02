"""
Version Tracker — Maintains a full versioning history of all ingested data
with date/time stamps on every change.

Each ingestion (crawl or document load) creates a version entry. When CF6
detects changes, the diff is recorded as a version entry with per-item
change details and timestamps.
"""

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path


class VersionTracker:
    def __init__(self, domain_name: str):
        self.domain_name = domain_name
        self.history_dir = Path(f"data/ingestion/version_history/{domain_name}")
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.history_file = self.history_dir / "version_log.json"
        self.history = self._load_history()

    def _load_history(self) -> dict:
        if self.history_file.exists():
            with open(self.history_file) as f:
                return json.load(f)
        return {
            "domain": self.domain_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "current_version": 0,
            "versions": [],
        }

    def _save_history(self):
        with open(self.history_file, "w") as f:
            json.dump(self.history, f, indent=2)

    def _content_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

    def record_initial_ingestion(self, crawled_docs: list, customer_docs: list) -> dict:
        now = datetime.now(timezone.utc)
        version_num = self.history["current_version"] + 1

        crawl_items = []
        for doc in crawled_docs:
            content = doc.get("markdown", doc.get("content", ""))
            crawl_items.append({
                "url": doc.get("url", doc.get("_source_url", "")),
                "title": doc.get("title", ""),
                "content_hash": self._content_hash(content),
                "source_description": doc.get("_source_description", ""),
                "ingested_at": now.isoformat(),
            })

        doc_items = []
        for doc in customer_docs:
            doc_items.append({
                "source_file": doc.metadata.get("source_file", "unknown"),
                "document_type": doc.metadata.get("document_type", "unclassified"),
                "content_hash": self._content_hash(doc.page_content),
                "ingested_at": now.isoformat(),
            })

        version_entry = {
            "version": version_num,
            "type": "initial_ingestion",
            "timestamp": now.isoformat(),
            "timestamp_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "crawled_sources": {
                "count": len(crawl_items),
                "items": crawl_items,
            },
            "customer_documents": {
                "count": len(doc_items),
                "items": doc_items,
            },
            "summary": f"Initial ingestion: {len(crawl_items)} web pages, {len(doc_items)} customer documents",
        }

        self.history["versions"].append(version_entry)
        self.history["current_version"] = version_num
        self._save_history()
        return version_entry

    def record_crawl_ingestion(self, crawled_docs: list) -> dict:
        now = datetime.now(timezone.utc)
        version_num = self.history["current_version"] + 1

        items = []
        for doc in crawled_docs:
            content = doc.get("markdown", doc.get("content", ""))
            items.append({
                "url": doc.get("url", doc.get("_source_url", "")),
                "title": doc.get("title", ""),
                "content_hash": self._content_hash(content),
                "source_description": doc.get("_source_description", ""),
                "ingested_at": now.isoformat(),
            })

        version_entry = {
            "version": version_num,
            "type": "crawl_ingestion",
            "timestamp": now.isoformat(),
            "timestamp_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "crawled_sources": {
                "count": len(items),
                "items": items,
            },
            "summary": f"Crawl ingestion: {len(items)} web pages",
        }

        self.history["versions"].append(version_entry)
        self.history["current_version"] = version_num
        self._save_history()
        return version_entry

    def record_document_ingestion(self, customer_docs: list) -> dict:
        now = datetime.now(timezone.utc)
        version_num = self.history["current_version"] + 1

        items = []
        for doc in customer_docs:
            items.append({
                "source_file": doc.metadata.get("source_file", "unknown"),
                "document_type": doc.metadata.get("document_type", "unclassified"),
                "content_hash": self._content_hash(doc.page_content),
                "ingested_at": now.isoformat(),
            })

        version_entry = {
            "version": version_num,
            "type": "document_ingestion",
            "timestamp": now.isoformat(),
            "timestamp_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "customer_documents": {
                "count": len(items),
                "items": items,
            },
            "summary": f"Document ingestion: {len(items)} customer documents",
        }

        self.history["versions"].append(version_entry)
        self.history["current_version"] = version_num
        self._save_history()
        return version_entry

    def record_cf6_update(self, changes: dict, baseline_date: str) -> dict:
        now = datetime.now(timezone.utc)
        version_num = self.history["current_version"] + 1

        new_items = []
        for item in changes.get("new", []):
            new_items.append({
                "url": item["url"],
                "title": item.get("title", ""),
                "detected_at": now.isoformat(),
                "change_type": "added",
            })

        modified_items = []
        for item in changes.get("modified", []):
            modified_items.append({
                "url": item["url"],
                "title": item.get("title", ""),
                "detected_at": now.isoformat(),
                "change_type": "modified",
            })

        removed_items = []
        for item in changes.get("removed", []):
            removed_items.append({
                "url": item["url"],
                "detected_at": now.isoformat(),
                "change_type": "removed",
            })

        version_entry = {
            "version": version_num,
            "type": "cf6_deviation_update",
            "timestamp": now.isoformat(),
            "timestamp_human": now.strftime("%B %d, %Y at %I:%M:%S %p UTC"),
            "compared_against_baseline": baseline_date,
            "changes": {
                "new": {"count": len(new_items), "items": new_items},
                "modified": {"count": len(modified_items), "items": modified_items},
                "removed": {"count": len(removed_items), "items": removed_items},
                "unchanged": changes.get("unchanged", 0),
            },
            "summary": (
                f"CF6 update: {len(new_items)} new, {len(modified_items)} modified, "
                f"{len(removed_items)} removed (compared against baseline {baseline_date})"
            ),
        }

        self.history["versions"].append(version_entry)
        self.history["current_version"] = version_num
        self._save_history()
        return version_entry

    def get_history(self) -> list:
        return self.history.get("versions", [])

    def get_current_version(self) -> int:
        return self.history.get("current_version", 0)

    def get_version(self, version_num: int) -> dict:
        for v in self.history.get("versions", []):
            if v["version"] == version_num:
                return v
        return {}

    def print_history(self):
        versions = self.get_history()
        if not versions:
            print("  No version history exists yet.")
            return

        print(f"\n  Domain: {self.domain_name}")
        print(f"  Current Version: v{self.get_current_version()}")
        print(f"  Total Versions: {len(versions)}")
        print(f"  {'─' * 60}")

        for v in versions:
            version_num = v["version"]
            v_type = v["type"]
            timestamp = v["timestamp_human"]
            summary = v["summary"]

            type_labels = {
                "initial_ingestion": "INITIAL",
                "crawl_ingestion": "CRAWL",
                "document_ingestion": "DOCS",
                "cf6_deviation_update": "CF6 UPDATE",
            }
            label = type_labels.get(v_type, v_type.upper())

            print(f"\n  v{version_num}  [{label}]  {timestamp}")
            print(f"    {summary}")

            if v_type == "cf6_deviation_update":
                changes = v.get("changes", {})
                if changes.get("new", {}).get("items"):
                    for item in changes["new"]["items"]:
                        print(f"    + NEW: {item.get('title', item['url'])}")
                        print(f"           Detected: {item['detected_at']}")
                if changes.get("modified", {}).get("items"):
                    for item in changes["modified"]["items"]:
                        print(f"    ~ MOD: {item.get('title', item['url'])}")
                        print(f"           Detected: {item['detected_at']}")
                if changes.get("removed", {}).get("items"):
                    for item in changes["removed"]["items"]:
                        print(f"    - DEL: {item['url']}")
                        print(f"           Detected: {item['detected_at']}")

        print(f"\n  {'─' * 60}")
