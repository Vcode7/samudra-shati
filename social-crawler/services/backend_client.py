"""
Backend API client for submitting external alerts
"""
import httpx
from typing import Optional, Dict, Any

from config import Config


class BackendClient:
    """
    Client for communicating with the samudra saathi backend API.
    """
    
    @staticmethod
    async def submit_alert(alert_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit an external alert to the backend.
        
        Args:
            alert_data: Dictionary containing:
                - source: Source type (twitter, youtube, news_rss)
                - source_id: Original post/video ID
                - source_url: URL to original content
                - text_content: Text content
                - media_url: URL to media (optional)
                - location_text: Location name (optional)
                - latitude: Latitude coordinate (optional)
                - longitude: Longitude coordinate (optional)
                - confidence_score: 0.0 - 1.0
                - keywords_matched: List of matched keywords
        
        Returns:
            Response from backend
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{Config.BACKEND_API_URL}/api/admin/external-alerts",
                    json=alert_data
                )
                
                if response.status_code == 200:
                    print(f"[Backend] Alert submitted successfully: {alert_data.get('source')}")
                    return response.json()
                else:
                    print(f"[Backend] Error submitting alert: {response.status_code}")
                    print(f"[Backend] Response: {response.text[:200]}")
                    return {"success": False, "error": response.text}
                    
        except httpx.ConnectError:
            print(f"[Backend] Connection error - is backend running at {Config.BACKEND_API_URL}?")
            return {"success": False, "error": "Connection failed"}
        except Exception as e:
            print(f"[Backend] Error: {e}")
            return {"success": False, "error": str(e)}
    
    @staticmethod
    async def health_check() -> bool:
        """
        Check if backend is reachable.
        
        Returns:
            True if backend is healthy
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{Config.BACKEND_API_URL}/")
                return response.status_code == 200
        except:
            return False
