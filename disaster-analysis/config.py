"""
Configuration for Disaster Analysis Service
"""
import os
from typing import List, Dict

# Disaster classification labels
DISASTER_LABELS: List[str] = [
    "coastal flooding with water covering streets and buildings",
    "cyclone damage with destroyed structures and debris",
    "dangerous high ocean waves crashing on shore",
    "boat accident or capsized vessel in water",
    "normal peaceful coastal scene with calm water",
]

# Simplified labels for output
LABEL_MAPPING: Dict[str, str] = {
    "coastal flooding with water covering streets and buildings": "coastal flooding",
    "cyclone damage with destroyed structures and debris": "cyclone damage",
    "dangerous high ocean waves crashing on shore": "high ocean waves",
    "boat accident or capsized vessel in water": "boat accident",
    "normal peaceful coastal scene with calm water": "normal coastal scene",
}

# Which labels indicate disaster
DISASTER_LABELS_SET = {
    "coastal flooding",
    "cyclone damage",
    "high ocean waves",
    "boat accident",
}

# Severity thresholds based on confidence
SEVERITY_THRESHOLDS: Dict[str, float] = {
    "CRITICAL": 0.90,
    "HIGH": 0.75,
    "MEDIUM": 0.50,
    "LOW": 0.30,
}

# Severity by disaster type (base severity)
TYPE_SEVERITY: Dict[str, str] = {
    "coastal flooding": "HIGH",
    "cyclone damage": "CRITICAL",
    "high ocean waves": "MEDIUM",
    "boat accident": "HIGH",
    "normal coastal scene": "LOW",
}

# Model settings
CLIP_MODEL: str = os.getenv("CLIP_MODEL", "ViT-B/32")
USE_GPU: bool = os.getenv("USE_GPU", "auto").lower() != "false"

# Video processing
VIDEO_FPS: int = int(os.getenv("VIDEO_FPS", "1"))  # Frames per second to extract
MAX_FRAMES: int = int(os.getenv("MAX_FRAMES", "30"))  # Max frames to analyze

# Logging
LOG_PREDICTIONS: bool = os.getenv("LOG_PREDICTIONS", "true").lower() == "true"
LOG_DIR: str = os.getenv("LOG_DIR", "./logs")

# Server
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8001"))
