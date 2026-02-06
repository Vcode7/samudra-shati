# Disaster Analysis Service

AI-powered image and video analysis for detecting coastal disaster events.

## Features

- **CLIP Zero-Shot Classification** - Detects disasters without training
- **Video Frame Analysis** - Extracts and analyzes frames at 1 FPS
- **Severity Classification** - LOW, MEDIUM, HIGH, CRITICAL
- **Modular Architecture** - Easily swap in custom models

## Quick Start

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

## API Endpoints

### Analyze Image
```bash
curl -X POST http://localhost:8001/analyze/image -F "file=@image.jpg"
```

### Analyze Video
```bash
curl -X POST http://localhost:8001/analyze/video -F "file=@video.mp4"
```

## Response Format

```json
{
  "is_disaster": true,
  "type": "coastal flooding",
  "severity": "HIGH",
  "confidence": 0.87,
  "explanation": "Coastal flooding detected with high confidence",
  "processing_time_ms": 245.3
}
```

## Labels Detected

- `coastal flooding`
- `cyclone damage`
- `high ocean waves`
- `boat accident`
- `normal coastal scene`
