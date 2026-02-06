"""
Prediction Aggregator

Combines predictions from multiple video frames using
majority voting and max severity.
"""
from typing import List
from collections import Counter
from analyzers.base_analyzer import AnalysisResult
from config import SEVERITY_THRESHOLDS


# Severity ranking (higher = more severe)
SEVERITY_RANK = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}


def aggregate_predictions(results: List[AnalysisResult]) -> AnalysisResult:
    """
    Aggregate predictions from multiple frames.
    
    Uses:
    - Majority vote for disaster type
    - Maximum severity among disaster frames
    - Average confidence weighted by agreement
    
    Args:
        results: List of AnalysisResult from individual frames
    
    Returns:
        Single aggregated AnalysisResult
    """
    if not results:
        return AnalysisResult(
            is_disaster=False,
            type="unknown",
            severity="LOW",
            confidence=0.0,
            explanation="No frames to analyze"
        )
    
    if len(results) == 1:
        return results[0]
    
    # Count disaster vs non-disaster frames
    disaster_frames = [r for r in results if r.is_disaster]
    normal_frames = [r for r in results if not r.is_disaster]
    
    # Majority vote on disaster detection
    is_disaster = len(disaster_frames) > len(normal_frames)
    
    if is_disaster:
        # Among disaster frames, get majority type
        type_counts = Counter(r.type for r in disaster_frames)
        top_type = type_counts.most_common(1)[0][0]
        
        # Get max severity among disaster frames
        max_severity = max(
            disaster_frames,
            key=lambda r: SEVERITY_RANK.get(r.severity, 0)
        ).severity
        
        # Calculate weighted confidence
        matching_frames = [r for r in disaster_frames if r.type == top_type]
        avg_confidence = sum(r.confidence for r in matching_frames) / len(matching_frames)
        
        # Boost confidence if high agreement
        agreement_ratio = len(matching_frames) / len(results)
        adjusted_confidence = min(1.0, avg_confidence * (0.8 + 0.2 * agreement_ratio))
        
        explanation = (
            f"{top_type.title()} detected in {len(disaster_frames)}/{len(results)} frames. "
            f"Max severity: {max_severity}. "
            f"Confidence: {int(adjusted_confidence * 100)}%."
        )
        
        return AnalysisResult(
            is_disaster=True,
            type=top_type,
            severity=max_severity,
            confidence=adjusted_confidence,
            explanation=explanation
        )
    else:
        # Mostly normal frames
        avg_confidence = sum(r.confidence for r in normal_frames) / len(normal_frames)
        
        explanation = (
            f"Normal coastal scene in {len(normal_frames)}/{len(results)} frames. "
            f"No significant disaster indicators detected."
        )
        
        return AnalysisResult(
            is_disaster=False,
            type="normal coastal scene",
            severity="LOW",
            confidence=avg_confidence,
            explanation=explanation
        )


def get_frame_summary(results: List[AnalysisResult]) -> dict:
    """
    Get summary statistics from frame analysis.
    
    Args:
        results: List of AnalysisResult
    
    Returns:
        Summary dict
    """
    if not results:
        return {"total_frames": 0}
    
    type_counts = Counter(r.type for r in results)
    severity_counts = Counter(r.severity for r in results)
    
    return {
        "total_frames": len(results),
        "disaster_frames": sum(1 for r in results if r.is_disaster),
        "normal_frames": sum(1 for r in results if not r.is_disaster),
        "type_distribution": dict(type_counts),
        "severity_distribution": dict(severity_counts),
        "avg_confidence": sum(r.confidence for r in results) / len(results),
        "max_confidence": max(r.confidence for r in results),
    }
