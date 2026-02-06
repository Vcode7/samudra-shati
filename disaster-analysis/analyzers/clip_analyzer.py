"""
CLIP Zero-Shot Analyzer

Uses OpenAI's CLIP model for zero-shot image classification.
No training required - just provide text labels.
"""
import torch
from PIL import Image
from typing import List, Optional
from transformers import CLIPProcessor, CLIPModel

from .base_analyzer import BaseAnalyzer, AnalysisResult
from config import (
    DISASTER_LABELS, LABEL_MAPPING, DISASTER_LABELS_SET,
    SEVERITY_THRESHOLDS, TYPE_SEVERITY, CLIP_MODEL, USE_GPU
)


class CLIPAnalyzer(BaseAnalyzer):
    """
    CLIP-based zero-shot disaster classification.
    
    Uses HuggingFace transformers for CLIP model loading.
    """
    
    def __init__(self, model_name: str = "openai/clip-vit-base-patch32"):
        self._model_name = model_name
        self._model: Optional[CLIPModel] = None
        self._processor: Optional[CLIPProcessor] = None
        self._device: str = "cpu"
        self._loaded = False
        
        # Load model
        self._load_model()
    
    def _load_model(self):
        """Load CLIP model and processor"""
        print(f"[CLIP] Loading model: {self._model_name}")
        
        try:
            self._processor = CLIPProcessor.from_pretrained(self._model_name)
            self._model = CLIPModel.from_pretrained(self._model_name)
            
            # Use GPU if available and enabled
            if USE_GPU and torch.cuda.is_available():
                self._device = "cuda"
                self._model = self._model.to(self._device)
                print(f"[CLIP] Using GPU: {torch.cuda.get_device_name(0)}")
            else:
                print("[CLIP] Using CPU")
            
            self._model.eval()
            self._loaded = True
            print("[CLIP] Model loaded successfully")
            
        except Exception as e:
            print(f"[CLIP] Error loading model: {e}")
            raise
    
    def analyze(self, image: Image.Image) -> AnalysisResult:
        """
        Analyze single image using CLIP zero-shot classification.
        """
        if not self._loaded:
            raise RuntimeError("Model not loaded")
        
        # Prepare input
        inputs = self._processor(
            text=DISASTER_LABELS,
            images=image,
            return_tensors="pt",
            padding=True
        )
        
        # Move to device
        inputs = {k: v.to(self._device) for k, v in inputs.items()}
        
        # Get predictions
        with torch.no_grad():
            outputs = self._model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim=1)
        
        # Get scores for each label
        scores = probs[0].cpu().numpy()
        label_scores = {
            LABEL_MAPPING[label]: float(score) 
            for label, score in zip(DISASTER_LABELS, scores)
        }
        
        # Get top prediction
        top_idx = scores.argmax()
        top_label = LABEL_MAPPING[DISASTER_LABELS[top_idx]]
        top_confidence = float(scores[top_idx])
        
        # Determine if disaster
        is_disaster = top_label in DISASTER_LABELS_SET
        
        # Determine severity
        severity = self._calculate_severity(top_label, top_confidence)
        
        # Generate explanation
        explanation = self._generate_explanation(top_label, top_confidence, is_disaster)
        
        return AnalysisResult(
            is_disaster=is_disaster,
            type=top_label,
            severity=severity,
            confidence=top_confidence,
            explanation=explanation,
            all_scores=label_scores
        )
    
    def analyze_batch(self, images: List[Image.Image]) -> List[AnalysisResult]:
        """
        Analyze multiple images efficiently.
        """
        if not self._loaded:
            raise RuntimeError("Model not loaded")
        
        results = []
        
        # Process in batches for memory efficiency
        batch_size = 4
        for i in range(0, len(images), batch_size):
            batch = images[i:i + batch_size]
            
            # Prepare batch input
            inputs = self._processor(
                text=DISASTER_LABELS,
                images=batch,
                return_tensors="pt",
                padding=True
            )
            
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self._model(**inputs)
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=1)
            
            # Process each image in batch
            for j, scores in enumerate(probs.cpu().numpy()):
                label_scores = {
                    LABEL_MAPPING[label]: float(score)
                    for label, score in zip(DISASTER_LABELS, scores)
                }
                
                top_idx = scores.argmax()
                top_label = LABEL_MAPPING[DISASTER_LABELS[top_idx]]
                top_confidence = float(scores[top_idx])
                is_disaster = top_label in DISASTER_LABELS_SET
                severity = self._calculate_severity(top_label, top_confidence)
                explanation = self._generate_explanation(top_label, top_confidence, is_disaster)
                
                results.append(AnalysisResult(
                    is_disaster=is_disaster,
                    type=top_label,
                    severity=severity,
                    confidence=top_confidence,
                    explanation=explanation,
                    all_scores=label_scores
                ))
        
        return results
    
    def _calculate_severity(self, label: str, confidence: float) -> str:
        """Calculate severity based on type and confidence"""
        if label == "normal coastal scene":
            return "LOW"
        
        # Get base severity for this disaster type
        base_severity = TYPE_SEVERITY.get(label, "MEDIUM")
        
        # Adjust based on confidence
        if confidence >= SEVERITY_THRESHOLDS["CRITICAL"]:
            return "CRITICAL"
        elif confidence >= SEVERITY_THRESHOLDS["HIGH"]:
            return max(base_severity, "HIGH", key=lambda x: list(SEVERITY_THRESHOLDS.keys()).index(x) if x in SEVERITY_THRESHOLDS else 0)
        elif confidence >= SEVERITY_THRESHOLDS["MEDIUM"]:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _generate_explanation(self, label: str, confidence: float, is_disaster: bool) -> str:
        """Generate human-readable explanation"""
        conf_pct = int(confidence * 100)
        
        if not is_disaster:
            return f"Normal coastal scene detected ({conf_pct}% confidence). No disaster indicators found."
        
        severity_word = "high" if confidence >= 0.75 else "moderate" if confidence >= 0.5 else "low"
        return f"{label.title()} detected with {severity_word} confidence ({conf_pct}%)."
    
    @property
    def model_name(self) -> str:
        return self._model_name
    
    @property
    def is_loaded(self) -> bool:
        return self._loaded
