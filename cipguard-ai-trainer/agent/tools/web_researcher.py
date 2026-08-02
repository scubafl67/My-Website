import os

try:
    from firecrawl import FirecrawlApp
except ImportError:
    FirecrawlApp = None


def web_research(query: str, source_type: str = "general") -> dict:
    api_key = os.getenv("FIRECRAWL_API_KEY", "")

    if not api_key:
        return {
            "found": False,
            "message": "Firecrawl API key not configured. Set FIRECRAWL_API_KEY in your environment. Falling back to LLM knowledge — answer from your training data and note that the information may not reflect the most recent regulatory updates.",
        }

    if FirecrawlApp is None:
        return {
            "found": False,
            "message": "firecrawl-py package not installed. Run: pip install firecrawl-py",
        }

    source_urls = {
        "nerc": "https://www.nerc.com",
        "ferc": "https://www.ferc.gov",
        "general": None,
    }

    base_url = source_urls.get(source_type)
    firecrawl = FirecrawlApp(api_key=api_key)

    try:
        if base_url:
            search_query = f"site:{base_url} {query}"
        else:
            search_query = f"NERC CIP {query}"

        results = firecrawl.search(search_query, params={"limit": 3})

        if not results or not results.get("data"):
            return {
                "found": False,
                "query": query,
                "source_type": source_type,
                "message": "No results found. Try broadening the search query.",
            }

        docs = []
        for item in results["data"][:3]:
            docs.append(
                {
                    "title": item.get("title", "Untitled"),
                    "url": item.get("url", ""),
                    "content": item.get("markdown", item.get("content", ""))[:2000],
                }
            )

        return {"found": True, "query": query, "source_type": source_type, "results": docs}

    except Exception as e:
        return {
            "found": False,
            "query": query,
            "message": f"Web research failed: {str(e)}. Answer from your training knowledge and note that current regulatory data could not be retrieved.",
        }
