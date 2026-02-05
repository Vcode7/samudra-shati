"""
RSS News Feed Crawler for disaster-related news articles
"""
import random
from datetime import datetime
from typing import List
from dataclasses import dataclass

import feedparser

from config import Config


@dataclass
class CrawlResult:
    """Result from a crawl operation"""
    source: str
    source_id: str
    source_url: str
    text: str
    media_url: str | None
    keywords: List[str]
    detected_at: datetime


class RSSCrawler:
    """
    Crawls RSS news feeds for disaster-related content.
    """
    
    @staticmethod
    async def fetch() -> List[CrawlResult]:
        """
        Fetch and parse news from configured RSS feeds.
        
        Returns:
            List of CrawlResult objects for disaster-related articles
        """
        results = []
        
        for feed_url in Config.NEWS_RSS_FEEDS:
            try:
                print(f"[RSS] Fetching: {feed_url}")
                feed = feedparser.parse(feed_url)
                
                if feed.bozo:
                    print(f"[RSS] Error parsing feed: {feed_url}")
                    continue
                
                for entry in feed.entries[:20]:  # Limit per feed
                    # Combine title and summary for keyword matching
                    title = entry.get("title", "")
                    summary = entry.get("summary", entry.get("description", ""))
                    text = f"{title} {summary}"
                    
                    # Check if any disaster keywords match
                    matched_keywords = [
                        kw for kw in Config.KEYWORDS
                        if kw.lower() in text.lower()
                    ]
                    
                    # Only include if disaster-related
                    if matched_keywords:
                        # Try to get media URL
                        media_url = None
                        if hasattr(entry, "media_content") and entry.media_content:
                            media_url = entry.media_content[0].get("url")
                        elif hasattr(entry, "enclosures") and entry.enclosures:
                            media_url = entry.enclosures[0].get("href")
                        
                        results.append(CrawlResult(
                            source="news_rss",
                            source_id=entry.get("id", entry.link),
                            source_url=entry.link,
                            text=text[:500],
                            media_url=media_url,
                            keywords=matched_keywords,
                            detected_at=datetime.utcnow()
                        ))
                        
            except Exception as e:
                print(f"[RSS] Error fetching {feed_url}: {e}")
                continue
        
        print(f"[RSS] Found {len(results)} disaster-related articles")
        return results
    
    @staticmethod
    async def _get_mock_results() -> List[CrawlResult]:
        """
        Generate mock RSS results for testing.
        """
        mock_articles = [
            {
                "id": "news_rss_1",
                "url": "https://example.com/news/flood-warning",
                "text": "IMD issues flood warning for Tamil Nadu coast as heavy rains expected",
                "keywords": ["flood", "tamilnadu rain"],
            },
            {
                "id": "news_rss_2",
                "url": "https://example.com/news/cyclone-update",
                "text": "Cyclone alert: Bay of Bengal depression to intensify into severe storm",
                "keywords": ["cyclone", "storm surge"],
            },
        ]
        
        if random.random() < 0.6:
            return []
        
        return [
            CrawlResult(
                source="news_rss",
                source_id=article["id"],
                source_url=article["url"],
                text=article["text"],
                media_url=None,
                keywords=article["keywords"],
                detected_at=datetime.utcnow()
            )
            for article in mock_articles
        ]
