import os
import uuid
import json
import httpx
from typing import Optional
from datetime import datetime
from PIL import Image
from ..config import settings


# Disaster Analysis Service URL (separate ML service)
ANALYSIS_SERVICE_URL = os.getenv("ANALYSIS_SERVICE_URL", "http://localhost:8001")


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
        if file_extension not in ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.avi', '.mov']:
            file_extension = '.jpg'
        
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Optional: Compress/resize image (skip for videos)
        if file_extension not in ['.mp4', '.avi', '.mov']:
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
    async def analyze_image_async(image_path: str, file_content: bytes, content_type: str) -> dict:
        """
        Analyze image/video using the Disaster Analysis Service.
        
        Calls the external CNN pipeline service for inference.
        """
        try:
            # Determine endpoint based on content type
            if content_type.startswith("video/"):
                endpoint = f"{ANALYSIS_SERVICE_URL}/analyze/video"
            else:
                endpoint = f"{ANALYSIS_SERVICE_URL}/analyze/image"
            
            print(f"\n{'='*50}")
            print(f"🤖 CALLING AI ANALYSIS SERVICE")
            print(f"{'='*50}")
            print(f"Endpoint: {endpoint}")
            print(f"Content-Type: {content_type}")
            
            # Call the analysis service
            async with httpx.AsyncClient(timeout=60.0) as client:
                files = {"file": (image_path, file_content, content_type)}
                response = await client.post(endpoint, files=files)
                
                if response.status_code != 200:
                    print(f"Analysis service error: {response.text}")
                    return ImageService._mock_analysis(image_path, error=response.text)
                
                result = response.json()
            
            # Map the response to our format
            analysis = {
                "model_version": "cnn-pipeline-v2.0",
                "analyzed_at": datetime.utcnow().isoformat(),
                "hazard_detected": result.get("is_disaster", False),
                "confidence": result.get("binary", {}).get("confidence", 0.0),
                "hazard_type": result.get("type", {}).get("label") or "none",
                "severity": ImageService._map_severity_to_number(
                    result.get("severity", {}).get("label")
                ),
                "severity_label": result.get("severity", {}).get("label"),
                "description": f"Binary: {result.get('binary', {}).get('label')} | "
                              f"Type: {result.get('type', {}).get('label')} | "
                              f"Severity: {result.get('severity', {}).get('label')}",
                "recommendations": ImageService._get_recommendations(
                    result.get("type", {}).get("label"),
                    result.get("severity", {}).get("label")
                ),
                "is_mock": False,
                "raw_response": result,
            }
            
            print(f"Result: {json.dumps(analysis, indent=2, default=str)}")
            print(f"{'='*50}\n")
            
            return analysis
            
        except httpx.ConnectError:
            print(f"⚠️ Analysis service not reachable at {ANALYSIS_SERVICE_URL}")
            return ImageService._mock_analysis(image_path, error="Service unreachable")
        except Exception as e:
            print(f"⚠️ Analysis error: {e}")
            return ImageService._mock_analysis(image_path, error=str(e))
    
    @staticmethod
    def _map_severity_to_number(severity_label: Optional[str]) -> int:
        """Map severity label to 1-10 scale"""
        mapping = {
            "low": 3,
            "medium": 6,
            "high": 9,
        }
        return mapping.get(severity_label, 5)
    
    @staticmethod
    def _get_recommendations(hazard_type: Optional[str], severity: Optional[str]) -> list:
        """Generate recommendations based on disaster type and severity"""
        recommendations = []
        
        if severity == "high":
            recommendations.append("Immediate evacuation recommended")
            recommendations.append("Alert all nearby residents")
        elif severity == "medium":
            recommendations.append("Prepare for possible evacuation")
            recommendations.append("Monitor situation closely")
        else:
            recommendations.append("Stay alert and monitor updates")
        
        if hazard_type == "flood":
            recommendations.append("Move to higher ground")
        elif hazard_type == "cyclone":
            recommendations.append("Seek sturdy shelter immediately")
        elif hazard_type == "fire":
            recommendations.append("Evacuate in opposite direction of smoke")
        elif hazard_type == "earthquake":
            recommendations.append("Move to open areas away from buildings")
        
        recommendations.append("Contact local authorities")
        
        return recommendations
    
    @staticmethod
    def _mock_analysis(image_path: str, error: str = None) -> dict:
        """Fallback mock analysis when service is unavailable"""
        return {
            "model_version": "mock-fallback",
            "analyzed_at": datetime.utcnow().isoformat(),
            "hazard_detected": True,
            "confidence": 0.5,
            "hazard_type": "unknown",
            "severity": 5,
            "description": f"Analysis service unavailable: {error}" if error else "Mock analysis",
            "recommendations": [
                "Manual verification required",
                "Contact local authorities"
            ],
            "is_mock": True,
        }
    
    @staticmethod
    def analyze_image(image_path: str) -> dict:
        """
        Synchronous wrapper for backward compatibility.
        
        NOTE: This is a MOCK version. Use analyze_image_async for real inference.
        """
        return ImageService._mock_analysis(image_path)
    
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
