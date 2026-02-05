"""
Social Media Crawler for Disaster Alerts

An independent service that monitors social media and news sources
for disaster-related content and submits alerts to the Samudar Shati backend.
"""
import asyncio
import sys
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import Config
from crawlers import TwitterCrawler, YouTubeCrawler, RSSCrawler
from processors import NLPFilter, LocationExtractor
from services import BackendClient


async def run_crawl_cycle():
    """
    Run one crawl cycle - fetch from all sources and submit relevant alerts.
    """
    print(f"\n{'='*60}")
    print(f"[Crawler] Starting crawl cycle at {datetime.now().isoformat()}")
    print(f"{'='*60}")
    
    all_results = []
    
    # Fetch from Twitter
    try:
        twitter_results = await TwitterCrawler.search(Config.KEYWORDS)
        print(f"[Twitter] Found {len(twitter_results)} items")
        all_results.extend(twitter_results)
    except Exception as e:
        print(f"[Twitter] Error: {e}")
    
    # Fetch from YouTube
    try:
        youtube_results = await YouTubeCrawler.search(Config.KEYWORDS)
        print(f"[YouTube] Found {len(youtube_results)} items")
        all_results.extend(youtube_results)
    except Exception as e:
        print(f"[YouTube] Error: {e}")
    
    # Fetch from RSS feeds
    try:
        rss_results = await RSSCrawler.fetch()
        print(f"[RSS] Found {len(rss_results)} items")
        all_results.extend(rss_results)
    except Exception as e:
        print(f"[RSS] Error: {e}")
    
    print(f"\n[Crawler] Total items collected: {len(all_results)}")
    
    # Filter and process results
    submitted_count = 0
    for item in all_results:
        try:
            # Calculate confidence score
            confidence = NLPFilter.score(item)
            
            # Skip low-confidence items
            if confidence < Config.MIN_CONFIDENCE_THRESHOLD:
                print(f"[Filter] Skipping low-confidence ({confidence:.2f}): {item.text[:50]}...")
                continue
            
            # Extract location
            location = LocationExtractor.extract(item)
            coordinates = LocationExtractor.get_coordinates(location) if location else None
            
            # Prepare alert data
            alert_data = {
                "source": item.source,
                "source_id": item.source_id,
                "source_url": item.source_url,
                "text_content": item.text,
                "media_url": item.media_url,
                "location_text": location,
                "latitude": coordinates[0] if coordinates else None,
                "longitude": coordinates[1] if coordinates else None,
                "confidence_score": confidence,
                "keywords_matched": item.keywords,
            }
            
            print(f"\n[Submit] Confidence: {confidence:.2f} | Location: {location or 'Unknown'}")
            print(f"[Submit] Text: {item.text[:100]}...")
            
            # Submit to backend
            result = await BackendClient.submit_alert(alert_data)
            if result.get("success") or result.get("id"):
                submitted_count += 1
                
        except Exception as e:
            print(f"[Error] Failed to process item: {e}")
    
    print(f"\n[Crawler] Crawl cycle complete. Submitted {submitted_count} alerts.")
    print(f"[Crawler] Next cycle in {Config.CRAWL_INTERVAL_MINUTES} minutes")


async def main():
    """
    Main entry point for the social crawler.
    """
    print("="*60)
    print("   Samudar Shati - Social Media Crawler")
    print("   Disaster Alert Monitoring Service")
    print("="*60)
    print(f"\nBackend URL: {Config.BACKEND_API_URL}")
    print(f"Crawl interval: {Config.CRAWL_INTERVAL_MINUTES} minutes")
    print(f"Confidence threshold: {Config.MIN_CONFIDENCE_THRESHOLD}")
    print(f"Monitoring {len(Config.KEYWORDS)} keywords")
    print(f"Monitoring {len(Config.NEWS_RSS_FEEDS)} RSS feeds")
    
    # Check backend connection
    print("\n[Startup] Checking backend connection...")
    if await BackendClient.health_check():
        print("[Startup] ✓ Backend is reachable")
    else:
        print("[Startup] ✗ Backend not reachable - alerts will fail to submit")
        print("[Startup] Make sure the backend is running at", Config.BACKEND_API_URL)
    
    # Run initial crawl
    print("\n[Startup] Running initial crawl cycle...")
    await run_crawl_cycle()
    
    # Set up scheduler
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_crawl_cycle,
        'interval',
        minutes=Config.CRAWL_INTERVAL_MINUTES
    )
    scheduler.start()
    
    print(f"\n[Scheduler] Started - running every {Config.CRAWL_INTERVAL_MINUTES} minutes")
    print("[Scheduler] Press Ctrl+C to stop\n")
    
    try:
        # Keep the event loop running
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        print("\n[Shutdown] Stopping crawler...")
        scheduler.shutdown()
        print("[Shutdown] Goodbye!")


if __name__ == "__main__":
    asyncio.run(main())
