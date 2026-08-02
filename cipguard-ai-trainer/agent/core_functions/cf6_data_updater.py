"""
CF6 — Knowledge Source Update & Deviation Detection

This is NOT just a query router — it is an autonomous update function that:
1. Periodically crawls configured NERC/FERC sources via Firecrawl
2. Compares current data against the baseline established at Step 1.2
3. Detects deviations (new standards, amended requirements, enforcement actions)
4. Updates the vector store with new/changed content
5. Flags deviations to the orchestrator so the AI can inform teammates

This runs as a background process or on-demand check, separate from the
per-message knowledge routing (which the system prompt handles natively).
"""

from data.ingestion.firecrawl_crawler import DomainCrawler
from data.ingestion.chunker import DomainChunker
from data.ingestion.version_tracker import VersionTracker
from data.vectorstore.store import DomainVectorStore


class KnowledgeUpdater:
    def __init__(self, domain_name: str):
        self.domain_name = domain_name
        self.crawler = DomainCrawler(domain_name)
        self.chunker = DomainChunker()
        self.store = DomainVectorStore(domain_name)
        self.tracker = VersionTracker(domain_name)

    def check_and_update(self) -> dict:
        print(f"\n[CF6] Checking for NERC CIP data changes against baseline...")

        change_report = self.crawler.check_for_changes()

        if not change_report["has_baseline"]:
            print("[CF6] No baseline exists. Run initial ingestion first.")
            return change_report

        if not change_report["has_changes"]:
            print("[CF6] No changes detected since last baseline.")
            return change_report

        changes = change_report["changes"]
        print(f"[CF6] Changes detected:")
        print(f"  New pages: {len(changes['new'])}")
        print(f"  Modified pages: {len(changes['modified'])}")
        print(f"  Removed pages: {len(changes['removed'])}")
        print(f"  Unchanged: {changes['unchanged']}")

        if changes["new"] or changes["modified"]:
            print("[CF6] Re-ingesting changed content into vector store...")
            new_docs = change_report.get("current_documents", [])
            chunks = self.chunker.chunk_crawled_docs(new_docs)
            added = self.store.add_documents(chunks)
            print(f"[CF6] Added {added} chunks to knowledge base.")

            self.crawler.save_baseline(new_docs)
            print("[CF6] New baseline saved.")

        version = self.tracker.record_cf6_update(changes, change_report["baseline_date"])
        print(f"[CF6] Version v{version['version']} recorded at {version['timestamp_human']}")

        deviation_summary = {
            "has_changes": True,
            "baseline_date": change_report["baseline_date"],
            "new_content": [
                {"url": item["url"], "title": item.get("title", "")}
                for item in changes["new"]
            ],
            "modified_content": [
                {"url": item["url"], "title": item.get("title", "")}
                for item in changes["modified"]
            ],
            "removed_content": [
                {"url": item["url"]}
                for item in changes["removed"]
            ],
        }

        return deviation_summary

    def get_deviation_briefing(self) -> str:
        report = self.check_and_update()

        if not report.get("has_changes"):
            return ""

        lines = [
            "## NERC CIP Data Update Alert",
            f"Changes detected since baseline ({report.get('baseline_date', 'unknown')}):",
        ]

        if report.get("new_content"):
            lines.append("\n**New Content Found:**")
            for item in report["new_content"]:
                lines.append(f"- {item.get('title', item['url'])}")

        if report.get("modified_content"):
            lines.append("\n**Modified Content:**")
            for item in report["modified_content"]:
                lines.append(f"- {item.get('title', item['url'])}")

        if report.get("removed_content"):
            lines.append("\n**Removed Content:**")
            for item in report["removed_content"]:
                lines.append(f"- {item['url']}")

        lines.append(
            "\nThe knowledge base has been updated. Inform the teammate about "
            "relevant changes during conversation when applicable."
        )

        return "\n".join(lines)
