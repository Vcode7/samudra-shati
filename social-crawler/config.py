"""
Configuration for Social Media Crawler
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Backend API
    BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000")
    
    # Twitter/X API
    TWITTER_API_KEY = os.getenv("TWITTER_API_KEY", "")
    TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET", "")
    TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "")
    
    # YouTube API
    YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
    
    # Crawl settings
    CRAWL_INTERVAL_MINUTES = int(os.getenv("CRAWL_INTERVAL_MINUTES", "3"))
    MIN_CONFIDENCE_THRESHOLD = float(os.getenv("MIN_CONFIDENCE_THRESHOLD", "0.5"))
    
    # Disaster-related keywords to search for
    KEYWORDS = [
        # English
        "flood", "flooding", "cyclone", "tsunami", "earthquake",
        "landslide", "storm surge", "coastal flooding", "hurricane",
        "typhoon", "disaster alert", "evacuation", "rescue",
        # Indian coastal areas
        "chennai flood", "mumbai cyclone", "odisha storm",
        "kerala flood", "andhra cyclone", "tamilnadu rain",
        "coastal erosion", "sea level rise", "high tide warning",
        # Hindi
        "बाढ़", "चक्रवात", "भूकंप", "सुनामी", "आपदा",
        # Tamil
        "வெள்ளம்", "புயல்", "நிலநடுக்கம்",
    ]
    
    # Indian coastal news RSS feeds
    NEWS_RSS_FEEDS = [
        "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms",  # India News
        "https://www.thehindu.com/news/national/feeder/default.rss",  # The Hindu National
        "https://indianexpress.com/section/india/feed/",  # Indian Express
    ]
    
    # Coastal cities to monitor
    COASTAL_CITIES = [
        "Chennai", "Mumbai", "Kolkata", "Visakhapatnam", "Kochi",
        "Mangalore", "Goa", "Puri", "Digha", "Paradip", "Cuddalore",
        "Nagapattinam", "Karaikal", "Puducherry", "Mahabalipuram",
    ]
