"""
YouTube Crawler for disaster-related video content
"""
import random
from datetime import datetime
from typing import List
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


class YouTubeCrawler:
    """
    Crawls YouTube for disaster-related video content.
    
    If no API key is configured, returns mock data for testing.
    """
    
    @staticmethod
    async def search(keywords: List[str]) -> List[CrawlResult]:
        """
        Search YouTube for disaster-related videos.
        
        Args:
            keywords: List of keywords to search for
        
        Returns:
            List of CrawlResult objects
        """
        # Check if YouTube API is configured
        if not Config.YOUTUBE_API_KEY:
            print("[YouTube] No API key configured, using mock data")
            return await YouTubeCrawler._get_mock_results()
        
        try:
            import httpx
            
            # Build search query
            query = " ".join(keywords[:5])
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    params={
                        "key": Config.YOUTUBE_API_KEY,
                        "q": query,
                        "part": "snippet",
                        "type": "video",
                        "maxResults": 10,
                        "relevanceLanguage": "en",
                        "order": "date",
                    }
                )
                
                if response.status_code != 200:
                    print(f"[YouTube] API error: {response.status_code}")
                    return []
                
                data = response.json()
                results = []
                
                for item in data.get("items", []):
                    video_id = item["id"]["videoId"]
                    snippet = item["snippet"]
                    
                    # Combine title and description for matching
                    text = f"{snippet['title']} {snippet.get('description', '')}"
                    
                    # Find which keywords matched
                    matched_keywords = [
                        kw for kw in keywords 
                        if kw.lower() in text.lower()
                    ]
                    
                    results.append(CrawlResult(
                        source="youtube",
                        source_id=video_id,
                        source_url=f"https://www.youtube.com/watch?v={video_id}",
                        text=text[:500],  # Limit text length
                        media_url=snippet.get("thumbnails", {}).get("high", {}).get("url"),
                        keywords=matched_keywords,
                        detected_at=datetime.utcnow()
                    ))
                
                return results
                
        except Exception as e:
            print(f"[YouTube] Error: {e}")
            return []
    
    @staticmethod
    async def _get_mock_results() -> List[CrawlResult]:
        """
        Generate mock YouTube results for testing.
        """
        mock_videos = [
            {
                "id": f"mock_yt_{random.randint(10000, 99999)}",
                "text": "LIVE: Cyclone Biparjoy approaching Gujarat coast - Latest updates and evacuation news",
                "keywords": ["cyclone", "evacuation"],
                "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            },
            {
                "id": f"mock_yt_{random.randint(10000, 99999)}",
                "text": "Chennai Floods 2023 - Rescue operations underway in coastal areas",
                "keywords": ["chennai flood", "rescue"],
                "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            },
        ]
        
        # Add randomness
        if random.random() < 0.5:
            return []
        
        selected = random.sample(mock_videos, k=random.randint(1, len(mock_videos)))
        
        return [
            CrawlResult(
                source="youtube",
                source_id=video["id"],
                source_url=f"https://www.youtube.com/watch?v={video['id']}",
                text=video["text"],
                media_url=video["thumbnail"],
                keywords=video["keywords"],
                detected_at=datetime.utcnow()
            )
            for video in selected
        ]
