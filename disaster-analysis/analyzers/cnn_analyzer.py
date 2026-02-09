"""
CNN Disaster Analyzer

3-Model Pipeline using pre-trained PyTorch checkpoints:
1. Binary Classifier: disaster / not_disaster
2. Type Classifier: flood / cyclone / fire / earthquake / other
3. Severity Classifier: low / medium / high
"""
import os
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image

from .base_analyzer import BaseAnalyzer, AnalysisResult
from .model import ResNetLSTM
from config import (
    BINARY_CHECKPOINT,
    TYPE_CHECKPOINT,
    SEVERITY_CHECKPOINT,
    BINARY_LABELS,
    TYPE_LABELS,
    SEVERITY_LABELS,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    """Structured result from the 3-model pipeline"""
    is_disaster: bool
    binary: Dict[str, Any] = field(default_factory=dict)
    type: Dict[str, Any] = field(default_factory=dict)
    severity: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "is_disaster": self.is_disaster,
            "binary": self.binary,
            "type": self.type,
            "severity": self.severity,
        }


class CNNAnalyzer(BaseAnalyzer):
    """
    3-Model CNN Pipeline Analyzer
    
    Pipeline:
    1. Binary → If "not_disaster", stop and return
    2. Type → Classify disaster type
    3. Severity → Classify severity level
    """
    
    def __init__(self):
        self._loaded = False
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"[CNNAnalyzer] Using device: {self._device}")
        
        # Models
        self._binary_model: Optional[ResNetLSTM] = None
        self._type_model: Optional[ResNetLSTM] = None
        self._severity_model: Optional[ResNetLSTM] = None
        
        # ImageNet normalization
        self._transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])
        
        # Load models
        self._load_models()
    
    def _load_models(self):
        """Load all three model checkpoints"""
        try:
            # Binary classifier (2 classes)
            logger.info(f"[CNNAnalyzer] Loading binary model from {BINARY_CHECKPOINT}")
            self._binary_model = ResNetLSTM(num_classes=2)
            self._binary_model.load_state_dict(torch.load(BINARY_CHECKPOINT, map_location=self._device))
            self._binary_model.to(self._device)
            self._binary_model.eval()
            
            # Type classifier (5 classes)
            logger.info(f"[CNNAnalyzer] Loading type model from {TYPE_CHECKPOINT}")
            self._type_model = ResNetLSTM(num_classes=5)
            self._type_model.load_state_dict(torch.load(TYPE_CHECKPOINT, map_location=self._device))
            self._type_model.to(self._device)
            self._type_model.eval()
            
            # Severity classifier (3 classes)
            logger.info(f"[CNNAnalyzer] Loading severity model from {SEVERITY_CHECKPOINT}")
            self._severity_model = ResNetLSTM(num_classes=3)
            self._severity_model.load_state_dict(torch.load(SEVERITY_CHECKPOINT, map_location=self._device))
            self._severity_model.to(self._device)
            self._severity_model.eval()
            
            self._loaded = True
            logger.info("[CNNAnalyzer] All models loaded successfully!")
            
        except Exception as e:
            logger.error(f"[CNNAnalyzer] Failed to load models: {e}")
            raise
    
    def _preprocess(self, image: Image.Image) -> torch.Tensor:
        """
        Preprocess image for model input.
        
        Returns tensor of shape [1, 1, 3, 224, 224] (batch, time, channels, H, W)
        """
        tensor = self._transform(image)  # [3, 224, 224]
        tensor = tensor.unsqueeze(0).unsqueeze(0)  # [1, 1, 3, 224, 224]
        return tensor.to(self._device)
    
    def _preprocess_batch(self, images: List[Image.Image]) -> torch.Tensor:
        """
        Preprocess multiple images for batch inference.
        
        Returns tensor of shape [1, T, 3, 224, 224] where T = number of frames
        """
        tensors = [self._transform(img) for img in images]  # List of [3, 224, 224]
        stacked = torch.stack(tensors, dim=0)  # [T, 3, 224, 224]
        batch = stacked.unsqueeze(0)  # [1, T, 3, 224, 224]
        return batch.to(self._device)
    
    @torch.no_grad()
    def _run_binary(self, tensor: torch.Tensor) -> Dict[str, Any]:
        """Run binary classifier"""
        logits = self._binary_model(tensor)
        probs = F.softmax(logits, dim=-1)

        p_not = probs[0, 0].item()   # index 0 = not_disaster
        p_dis = probs[0, 1].item()   # index 1 = disaster

        # Safety-first decision rule
        if p_dis < 0.3 and p_not > 0.7:
            pred_idx = 0  # not_disaster
        else:
            pred_idx = 1  # disaster

        confidence = probs[0, pred_idx].item()
        label = BINARY_LABELS[pred_idx]

        
        logger.info(f"[Binary] Label: {label} | Confidence: {confidence:.4f}")
        
        return {
            "label": label,
            "confidence": round(confidence, 4),
            "logits": logits[0].cpu().tolist(),
        }
    
    @torch.no_grad()
    def _run_type(self, tensor: torch.Tensor) -> Dict[str, Any]:
        """Run type classifier"""
        logits = self._type_model(tensor)
        probs = F.softmax(logits, dim=-1)
        pred_idx = torch.argmax(probs, dim=-1).item()
        confidence = probs[0, pred_idx].item()
        label = TYPE_LABELS[pred_idx]
        
        logger.info(f"[Type] Label: {label} | Confidence: {confidence:.4f}")
        
        return {
            "label": label,
            "confidence": round(confidence, 4),
        }
    
    @torch.no_grad()
    def _run_severity(self, tensor: torch.Tensor) -> Dict[str, Any]:
        """Run severity classifier"""
        logits = self._severity_model(tensor)
        probs = F.softmax(logits, dim=-1)
        pred_idx = torch.argmax(probs, dim=-1).item()
        confidence = probs[0, pred_idx].item()
        label = SEVERITY_LABELS[pred_idx]
        
        logger.info(f"[Severity] Label: {label} | Confidence: {confidence:.4f}")
        
        return {
            "label": label,
            "confidence": round(confidence, 4),
        }
    
    def analyze_pipeline(self, image: Image.Image) -> PipelineResult:
        """
        Run the full 3-model pipeline on a single image.
        
        Returns PipelineResult with structured output.
        """
        tensor = self._preprocess(image)
        
        # Step 1: Binary classification
        binary_result = self._run_binary(tensor)
        
        if binary_result["label"] == "not_disaster":
            # Not a disaster - stop pipeline
            return PipelineResult(
                is_disaster=False,
                binary=binary_result,
                type={"label": None, "confidence": None},
                severity={"label": None, "confidence": None},
            )
        
        # Step 2: Type classification
        type_result = self._run_type(tensor)
        
        # Step 3: Severity classification
        severity_result = self._run_severity(tensor)
        
        return PipelineResult(
            is_disaster=True,
            binary=binary_result,
            type=type_result,
            severity=severity_result,
        )
    
    def analyze_pipeline_video(self, frames: List[Image.Image]) -> PipelineResult:
        """
        Run pipeline on video frames (aggregated).
        
        Uses temporal aggregation - all frames fed to LSTM together.
        """
        if not frames:
            return PipelineResult(
                is_disaster=False,
                binary={"label": "not_disaster", "confidence": 0.0},
                type={"label": None, "confidence": None},
                severity={"label": None, "confidence": None},
            )
        
        tensor = self._preprocess_batch(frames)
        
        # Step 1: Binary
        binary_result = self._run_binary(tensor)
        
        if binary_result["label"] == "not_disaster":
            return PipelineResult(
                is_disaster=False,
                binary=binary_result,
                type={"label": None, "confidence": None},
                severity={"label": None, "confidence": None},
            )
        
        # Step 2: Type
        type_result = self._run_type(tensor)
        
        # Step 3: Severity
        severity_result = self._run_severity(tensor)
        
        return PipelineResult(
            is_disaster=True,
            binary=binary_result,
            type=type_result,
            severity=severity_result,
        )
    
    def analyze(self, image: Image.Image) -> AnalysisResult:
        """
        Analyze single image (BaseAnalyzer interface).
        
        Converts PipelineResult to legacy AnalysisResult format.
        """
        result = self.analyze_pipeline(image)
        
        # Map to legacy format
        disaster_type = result.type.get("label") or "none"
        severity = result.severity.get("label") or "low"
        confidence = result.binary.get("confidence", 0.0)
        
        # Map severity to uppercase for legacy API
        severity_map = {"low": "LOW", "medium": "MEDIUM", "high": "HIGH"}
        severity_upper = severity_map.get(severity, "LOW")
        
        explanation = f"Binary: {result.binary.get('label')} ({result.binary.get('confidence', 0):.2%})"
        if result.is_disaster:
            explanation += f" | Type: {disaster_type} | Severity: {severity}"
        
        return AnalysisResult(
            is_disaster=result.is_disaster,
            type=disaster_type,
            severity=severity_upper,
            confidence=confidence,
            explanation=explanation,
        )
    
    def analyze_batch(self, images: List[Image.Image]) -> List[AnalysisResult]:
        """Analyze multiple images individually"""
        return [self.analyze(img) for img in images]
    
    @property
    def model_name(self) -> str:
        return "ResNetLSTM-3Model-Pipeline"
    
    @property
    def is_loaded(self) -> bool:
        return self._loaded
