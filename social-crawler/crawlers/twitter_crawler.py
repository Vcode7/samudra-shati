"""
Twitter/X Crawler for disaster-related content
"""
import asyncio
import random
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import dataclass

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


class TwitterCrawler:
    """
    Crawls Twitter/X for disaster-related content.
    
    If no API key is configured, returns mock data for testing.
    """
    
    @staticmethod
    async def search(keywords: List[str]) -> List[CrawlResult]:
        """
        Search Twitter for disaster-related content.
        
        Args:
            keywords: List of keywords to search for
        
        Returns:
            List of CrawlResult objects
        """
        # Check if Twitter API is configured
        if not Config.TWITTER_BEARER_TOKEN:
            print("[Twitter] No API key configured, using mock data")
            return await TwitterCrawler._get_mock_results()
        
        # Real Twitter API implementation would go here
        # Using Twitter API v2 with bearer token
        try:
            import httpx
            
            headers = {
                "Authorization": f"Bearer {Config.TWITTER_BEARER_TOKEN}",
            }
            
            # Build search query
            query = " OR ".join(keywords[:10])  # Twitter has query length limits
            query += " -is:retweet lang:en"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.twitter.com/2/tweets/search/recent",
                    headers=headers,
                    params={
                        "query": query,
                        "max_results": 10,
                        "tweet.fields": "created_at,geo,text",
                    }
                )
                
                if response.status_code != 200:
                    print(f"[Twitter] API error: {response.status_code}")
                    return []
                
                data = response.json()
                results = []
                
                for tweet in data.get("data", []):
                    # Find which keywords matched
                    matched_keywords = [
                        kw for kw in keywords 
                        if kw.lower() in tweet["text"].lower()
                    ]
                    
                    results.append(CrawlResult(
                        source="twitter",
                        source_id=tweet["id"],
                        source_url=f"https://twitter.com/i/status/{tweet['id']}",
                        text=tweet["text"],
                        media_url=None,  # Would need media expansion
                        keywords=matched_keywords,
                        detected_at=datetime.utcnow()
                    ))
                
                return results
                
        except Exception as e:
            print(f"[Twitter] Error: {e}")
            return []
    
    @staticmethod
    async def _get_mock_results() -> List[CrawlResult]:
        """
        Generate mock Twitter results for testing.
        """
        mock_tweets = [
            {
                "id": f"mock_{random.randint(100000, 999999)}",
                "text": "Heavy flooding reported in Chennai coastal areas. Residents advised to evacuate. #ChennaiFloods #DisasterAlert",
                "keywords": ["flooding", "chennai flood", "evacuate"],
            },
            {
                "id": f"mock_{random.randint(100000, 999999)}",
                "text": "Cyclone warning issued for Odisha coast. Expected landfall in 24 hours. Stay safe!",
                "keywords": ["cyclone", "odisha storm"],
            },
            {
                "id": f"mock_{random.randint(100000, 999999)}",
                "text": "Mumbai experiences high tide warning today. Avoid marine drive area until evening.",
                "keywords": ["high tide warning", "coastal flooding"],
            },
        ]
        
        # Add some randomness - don't always return results
        if random.random() < 0.3:
            return []
        
        # Return random subset of mock tweets
        selected = random.sample(mock_tweets, k=random.randint(1, len(mock_tweets)))
        
        return [
            CrawlResult(
                source="twitter",
                source_id=tweet["id"],
                source_url=f"https://twitter.com/i/status/{tweet['id']}",
                text=tweet["text"],
                media_url=None,
                keywords=tweet["keywords"],
                detected_at=datetime.utcnow()
            )
            for tweet in selected
        ]
