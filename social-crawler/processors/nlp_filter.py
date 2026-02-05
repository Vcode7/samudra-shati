"""
NLP-based filtering for disaster-related content
"""
from typing import List, Any
import re

from config import Config


class NLPFilter:
    """
    Filters and scores content for disaster relevance using NLP techniques.
    """
    
    # High-priority keywords that indicate immediate danger
    URGENT_KEYWORDS = [
        "evacuate", "evacuation", "emergency", "alert", "warning",
        "immediate", "danger", "rescue", "stranded", "trapped",
        "breaking", "live", "now",
    ]
    
    # Disaster type keywords
    DISASTER_KEYWORDS = [
        "flood", "flooding", "cyclone", "hurricane", "typhoon",
        "tsunami", "earthquake", "landslide", "storm surge",
        "high tide", "coastal erosion", "heavy rain",
    ]
    
    # Location keywords that boost relevance
    LOCATION_KEYWORDS = Config.COASTAL_CITIES + [
        "coast", "coastal", "beach", "sea", "ocean", "shore",
        "bay", "harbor", "port", "marine",
    ]
    
    @staticmethod
    def score(item: Any) -> float:
        """
        Calculate a confidence score for the item (0.0 - 1.0).
        
        Higher scores indicate more likely to be a genuine disaster report.
        
        Args:
            item: CrawlResult object with text and keywords
        
        Returns:
            Confidence score between 0.0 and 1.0
        """
        text = item.text.lower()
        score = 0.0
        
        # Base score from matched keywords
        keyword_count = len(item.keywords)
        score += min(0.3, keyword_count * 0.1)  # Max 0.3 from keyword matches
        
        # Boost for urgent keywords
        urgent_count = sum(1 for kw in NLPFilter.URGENT_KEYWORDS if kw in text)
        score += min(0.25, urgent_count * 0.08)
        
        # Boost for disaster type keywords
        disaster_count = sum(1 for kw in NLPFilter.DISASTER_KEYWORDS if kw in text)
        score += min(0.2, disaster_count * 0.05)
        
        # Boost for location mentions
        location_count = sum(1 for loc in NLPFilter.LOCATION_KEYWORDS if loc.lower() in text)
        score += min(0.15, location_count * 0.05)
        
        # Boost for news credibility indicators
        if any(x in text for x in ["official", "government", "imd", "ndrf", "ndma"]):
            score += 0.1
        
        # Negative signals
        if any(x in text for x in ["fake", "hoax", "movie", "trailer", "game"]):
            score -= 0.3
        
        # Ensure score is between 0 and 1
        return max(0.0, min(1.0, score))
    
    @staticmethod
    def is_relevant(item: Any) -> bool:
        """
        Check if an item is relevant enough to process.
        
        Args:
            item: CrawlResult object
        
        Returns:
            True if item should be processed
        """
        score = NLPFilter.score(item)
        return score >= Config.MIN_CONFIDENCE_THRESHOLD
    
    @staticmethod
    def extract_severity(text: str) -> int:
        """
        Extract severity level from text (1-5).
        
        Args:
            text: Content text
        
        Returns:
            Severity level 1-5
        """
        text_lower = text.lower()
        
        # Check for severity indicators
        if any(x in text_lower for x in ["severe", "extreme", "catastrophic", "massive"]):
            return 5
        elif any(x in text_lower for x in ["major", "significant", "heavy", "serious"]):
            return 4
        elif any(x in text_lower for x in ["moderate", "considerable"]):
            return 3
        elif any(x in text_lower for x in ["minor", "light", "small"]):
            return 2
        
        # Default severity based on disaster type
        if any(x in text_lower for x in ["tsunami", "earthquake", "cyclone"]):
            return 4
        elif any(x in text_lower for x in ["flood", "storm"]):
            return 3
        
        return 2  # Default
