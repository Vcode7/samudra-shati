# Social Media Crawler for Disaster Alerts

An independent Python service that monitors social media and news sources for disaster-related content and submits alerts to the Samudar Shati backend.

## Features

- **Twitter/X Monitoring** - Searches for disaster-related keywords
- **YouTube Monitoring** - Searches for disaster-related videos
- **RSS News Feeds** - Monitors Indian coastal news sources
- **NLP Filtering** - Filters content for relevance and extracts location information
- **Automatic Alert Submission** - Sends high-confidence alerts to the backend

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Run the crawler:
```bash
python main.py
```

## Configuration

Edit `config.py` to customize:
- Crawl interval (default: 3 minutes)
- Confidence threshold (default: 0.5)
- Keywords to monitor
- News RSS feeds

## API Keys Required

- **Twitter/X API** (optional) - For real-time Twitter monitoring
- **YouTube Data API** (optional) - For YouTube video search

If no API keys are configured, the crawler will use mock data for testing.

## Architecture

```
social-crawler/
├── main.py                 # Entry point with scheduler
├── config.py               # Configuration settings
├── crawlers/
│   ├── twitter_crawler.py  # Twitter/X monitoring
│   ├── youtube_crawler.py  # YouTube monitoring
│   └── rss_crawler.py      # RSS news feeds
├── processors/
│   ├── nlp_filter.py       # NLP-based filtering
│   └── location_extractor.py
└── services/
    └── backend_client.py   # Backend API client
```
