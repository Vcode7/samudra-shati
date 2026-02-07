"""
AI Service - Mock implementation for disaster video/image analysis.
This is a placeholder that will be replaced with actual ML model integration.
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


async def run_ai_scan(file_path: str, file_type: str = "image") -> Dict:
    """
    Run AI analysis on uploaded disaster media.
    
    This is a MOCK implementation that returns placeholder results.
    In production, this would call an actual ML model for:
    - Disaster type detection (flood, fire, earthquake, etc.)
    - Severity estimation
    - Object detection (people, buildings, vehicles)
    - Damage assessment
    
    Args:
        file_path: Path to the uploaded file
        file_type: Either "image" or "video"
    
    Returns:
        Dict with analysis results
    """
    logger.info(f"[AI SCAN] Running mock analysis on {file_type}: {file_path}")
    
    # Mock placeholder response
    mock_result = {
        "analyzed": True,
        "model_version": "mock_v1.0",
        "file_type": file_type,
        "analysis": {
            "disaster_detected": True,
            "disaster_type_prediction": "unknown",
            "confidence_score": 0.0,  # Placeholder
            "severity_prediction": "moderate",
            "objects_detected": [],
            "requires_verification": True,
        },
        "message": "Mock AI scan completed. Real model integration pending."
    }
    
    return mock_result


async def analyze_disaster_severity(
    disaster_type: str,
    description: str,
    location_data: Optional[Dict] = None
) -> Dict:
    """
    Analyze disaster severity based on text and location.
    
    Mock implementation - returns placeholder severity score.
    """
    logger.info(f"[AI SCAN] Analyzing severity for: {disaster_type}")
    
    return {
        "severity_score": 5,  # 1-10 scale
        "recommended_radius_km": 2.0,
        "evacuation_priority": "medium",
        "resources_needed": ["ambulance", "fire_truck", "rescue_boat"],
        "is_mock": True
    }
