import os
import json
import yaml
from datetime import datetime, timezone
from pathlib import Path

try:
    from firecrawl import FirecrawlApp
except ImportError:
    FirecrawlApp = None


class DomainCrawler:
    def __init__(self, domain_name: str, api_key: str = None):
        self.api_key = api_key or os.getenv("FIRECRAWL_API_KEY", "")
        if not self.api_key:
            raise ValueError("FIRECRAWL_API_KEY is required. Set it in your environment or pass it directly.")
        if FirecrawlApp is None:
            raise ImportError("firecrawl-py package not installed. Run: pip install firecrawl-py")
        self.firecrawl = FirecrawlApp(api_key=self.api_key)
        self.domain_name = domain_name
        self.sources = self._load_sources()
        self.baseline_dir = Path(f"data/ingestion/baselines/{domain_name}")
        self.baseline_dir.mkdir(parents=True, exist_ok=True)

    def _load_sources(self) -> list:
        config_path = f"domains/{self.domain_name}/data_sources.yaml"
        with open(config_path) as f:
            config = yaml.safe_load(f)
        return config.get("crawl_sources", [])

    def crawl_all(self) -> list:
        all_docs = []
        for source in self.sources:
            print(f"  Crawling: {source['url']}")
            try:
                result = self.firecrawl.crawl_url(
                    source["url"],
                    params={
                        "limit": 50,
                        "scrapeOptions": {"formats": ["markdown"]},
                    },
                    poll_interval=5,
                )
                for doc in result.get("data", []):
                    doc["_source_description"] = source["description"]
                    doc["_source_url"] = source["url"]
                    doc["_crawl_timestamp"] = datetime.now(timezone.utc).isoformat()
                    all_docs.append(doc)
                print(f"    Found {len(result.get('data', []))} pages")
            except Exception as e:
                print(f"    Error crawling {source['url']}: {e}")
        return all_docs

    def scrape_single(self, url: str) -> dict:
        return self.firecrawl.scrape_url(url, params={"formats": ["markdown"]})

    def save_baseline(self, documents: list) -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        baseline_file = self.baseline_dir / f"baseline_{timestamp}.json"
        with open(baseline_file, "w") as f:
            json.dump(
                {
                    "domain": self.domain_name,
                    "timestamp": timestamp,
                    "document_count": len(documents),
                    "documents": [
                        {
                            "url": d.get("url", d.get("_source_url", "")),
                            "title": d.get("title", ""),
                            "content_hash": hash(d.get("markdown", d.get("content", ""))),
                            "source": d.get("_source_description", ""),
                        }
                        for d in documents
                    ],
                },
                f,
                indent=2,
            )
        return str(baseline_file)

    def check_for_changes(self) -> dict:
        baselines = sorted(self.baseline_dir.glob("baseline_*.json"))
        if not baselines:
            return {"has_baseline": False, "message": "No baseline exists. Run initial ingestion first."}

        with open(baselines[-1]) as f:
            baseline = json.load(f)

        baseline_hashes = {d["url"]: d["content_hash"] for d in baseline["documents"]}

        current_docs = self.crawl_all()
        changes = {"new": [], "modified": [], "removed": [], "unchanged": 0}

        current_urls = set()
        for doc in current_docs:
            url = doc.get("url", doc.get("_source_url", ""))
            current_urls.add(url)
            content_hash = hash(doc.get("markdown", doc.get("content", "")))
            if url not in baseline_hashes:
                changes["new"].append({"url": url, "title": doc.get("title", "")})
            elif baseline_hashes[url] != content_hash:
                changes["modified"].append({"url": url, "title": doc.get("title", "")})
            else:
                changes["unchanged"] += 1

        for url in baseline_hashes:
            if url not in current_urls:
                changes["removed"].append({"url": url})

        has_changes = bool(changes["new"] or changes["modified"] or changes["removed"])

        return {
            "has_baseline": True,
            "baseline_date": baseline["timestamp"],
            "has_changes": has_changes,
            "changes": changes,
            "current_documents": current_docs if has_changes else [],
        }
