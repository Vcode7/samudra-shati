"""
Configuration for Disaster Analysis Service

3-Model CNN Pipeline Configuration
"""
import os
from typing import List, Dict

# =============================================================================
# Model Checkpoints
# =============================================================================
CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), "checkpoints")

# Binary classifier: disaster / not_disaster
BINARY_CHECKPOINT = os.path.join(CHECKPOINT_DIR, "binary_epoch_4.pt")

# Type classifier: flood / cyclone / fire / earthquake / other
TYPE_CHECKPOINT = os.path.join(CHECKPOINT_DIR, "type_epoch_7.pt")

# Severity classifier: low / medium / high
SEVERITY_CHECKPOINT = os.path.join(CHECKPOINT_DIR, "severity_epoch_3.pt")

# =============================================================================
# Label Mappings (MUST match training order)
# =============================================================================

# Binary labels - index 0: not_disaster, index 1: disaster
BINARY_LABELS: List[str] = ["not_disaster", "disaster"]

# Type labels - 5 classes
TYPE_LABELS: List[str] = ["flood", "cyclone", "fire", "earthquake", "other"]

# Severity labels - 3 classes
SEVERITY_LABELS: List[str] = ["low", "medium", "high"]

# =============================================================================
# Video Processing
# =============================================================================
VIDEO_FRAME_STRIDE: int = int(os.getenv("VIDEO_FRAME_STRIDE", "30"))  # Extract every 30th frame
MAX_FRAMES: int = int(os.getenv("MAX_FRAMES", "30"))  # Max frames to analyze

# =============================================================================
# Device Settings
# =============================================================================
USE_GPU: bool = os.getenv("USE_GPU", "auto").lower() != "false"

# =============================================================================
# Logging
# =============================================================================
LOG_PREDICTIONS: bool = os.getenv("LOG_PREDICTIONS", "true").lower() == "true"
LOG_DIR: str = os.getenv("LOG_DIR", "./logs")

# =============================================================================
# Server Configuration
# =============================================================================
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8001"))

# =============================================================================
# Severity Mapping (for backend compatibility)
# =============================================================================
SEVERITY_TO_LEVEL: Dict[str, int] = {
    "low": 3,
    "medium": 6,
    "high": 9,
}

TYPE_TO_SEVERITY_BASE: Dict[str, str] = {
    "flood": "high",
    "cyclone": "high",
    "fire": "high",
    "earthquake": "high",
    "other": "medium",
}

SEVERITY_THRESHOLDS = {
    "low": 0.33,
    "medium": 0.66,
    "high": 1.0,
}
