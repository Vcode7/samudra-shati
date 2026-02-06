"""
Base Analyzer Interface

Abstract base class for disaster detection models.
Allows easy swapping between CLIP, custom CNN, ViT, etc.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, List
from PIL import Image


@dataclass
class AnalysisResult:
    """Result from analyzing a single image"""
    is_disaster: bool
    type: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    confidence: float  # 0.0 - 1.0
    explanation: str
    all_scores: Optional[dict] = None  # All label scores for debugging
    
    def to_dict(self) -> dict:
        return {
            "is_disaster": self.is_disaster,
            "type": self.type,
            "severity": self.severity,
            "confidence": self.confidence,
            "explanation": self.explanation,
        }


class BaseAnalyzer(ABC):
    """
    Abstract base class for image disaster analyzers.
    
    Implement this interface to add new models (CNN, ViT, etc.)
    """
    
    @abstractmethod
    def analyze(self, image: Image.Image) -> AnalysisResult:
        """
        Analyze a single image for disaster content.
        
        Args:
            image: PIL Image to analyze
        
        Returns:
            AnalysisResult with prediction
        """
        pass
    
    @abstractmethod
    def analyze_batch(self, images: List[Image.Image]) -> List[AnalysisResult]:
        """
        Analyze multiple images (for video frame processing).
        
        Args:
            images: List of PIL Images
        
        Returns:
            List of AnalysisResult, one per image
        """
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model identifier"""
        pass
    
    @property
    @abstractmethod
    def is_loaded(self) -> bool:
        """Check if model is loaded and ready"""
        pass
