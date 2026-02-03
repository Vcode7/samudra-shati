import os
import uuid
import json
from typing import Optional
from datetime import datetime
from PIL import Image
from ..config import settings


class ImageService:
    """
    Service for handling image uploads and AI analysis
    """
    
    @staticmethod
    def ensure_upload_dir():
        """Ensure upload directory exists"""
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    @staticmethod
    async def save_image(file_content: bytes, original_filename: str) -> str:
        """
        Save uploaded image to disk
        
        Returns: relative path to saved image
        """
        ImageService.ensure_upload_dir()
        
        # Generate unique filename
        file_extension = os.path.splitext(original_filename)[1].lower()
        if file_extension not in ['.jpg', '.jpeg', '.png', '.webp']:
            file_extension = '.jpg'
        
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Optional: Compress/resize image
        try:
            img = Image.open(file_path)
            
            # Resize if too large (max 1920px on longest side)
            max_size = 1920
            if max(img.size) > max_size:
                ratio = max_size / max(img.size)
                new_size = tuple(int(dim * ratio) for dim in img.size)
                img = img.resize(new_size, Image.Resampling.LANCZOS)
                img.save(file_path, optimize=True, quality=85)
        except Exception as e:
            print(f"Warning: Could not optimize image: {e}")
        
        return unique_filename
    
    @staticmethod
    def analyze_image(image_path: str) -> dict:
        """
        Analyze image for disaster detection
        
        TODO: Replace with actual AI model integration
        This is a MOCK implementation that returns placeholder results
        
        Future integration points:
        - Load trained disaster detection model
        - Preprocess image
        - Run inference
        - Return classification results with confidence scores
        """
        
        # MOCK RESPONSE - Replace with actual AI model
        mock_analysis = {
            "model_version": "mock-v1.0",
            "analyzed_at": datetime.utcnow().isoformat(),
            "hazard_detected": True,
            "confidence": 0.87,
            "hazard_type": "flooding",
            "severity": 7,  # 1-10 scale
            "description": "Potential flooding detected in coastal area",
            "recommendations": [
                "Immediate evacuation recommended",
                "Alert nearby residents",
                "Contact local authorities"
            ],
            # TODO: Add actual model outputs
            "is_mock": True
        }
        
        print(f"\n{'='*50}")
        print(f"🤖 MOCK AI ANALYSIS")
        print(f"{'='*50}")
        print(f"Image: {image_path}")
        print(f"Result: {json.dumps(mock_analysis, indent=2)}")
        print(f"{'='*50}\n")
        
        return mock_analysis
    
    @staticmethod
    def delete_image(filename: str) -> bool:
        """Delete an image file"""
        try:
            file_path = os.path.join(settings.UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
        except Exception as e:
            print(f"Error deleting image: {e}")
        
        return False
    
    @staticmethod
    def get_image_url(filename: str) -> str:
        """Get public URL for an image"""
        # In production, this would return a CDN URL or signed URL
        return f"/uploads/{filename}"
