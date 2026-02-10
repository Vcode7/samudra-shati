import httpx
from typing import Dict, Optional
from datetime import datetime


class MarineClient:
    """Client for Open-Meteo Marine API (free, no API key required)"""
    
    BASE_URL = "https://marine-api.open-meteo.com/v1/marine"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def get_marine_forecast(self, lat: float, lon: float) -> Optional[Dict]:
        """
        Get marine forecast data for a location
        
        Returns:
            {
                "wave_height": float (meters),
                "wave_direction": float (degrees),
                "wave_period": float (seconds),
                "swell_wave_height": float (meters),
                "wind_wave_height": float (meters),
                "ocean_current_velocity": float (m/s),
                "timestamp": datetime
            }
        """
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": [
                "wave_height",
                "wave_direction",
                "wave_period",
                "swell_wave_height",
                "wind_wave_height",
                "ocean_current_velocity"
            ]
        }
        
        try:
            response = await self.client.get(self.BASE_URL, params=params)
            
            if response.status_code == 200:
                data = response.json()
                current = data.get("current", {})
                
                return {
                    "wave_height": current.get("wave_height", 0),
                    "wave_direction": current.get("wave_direction", 0),
                    "wave_period": current.get("wave_period", 0),
                    "swell_wave_height": current.get("swell_wave_height", 0),
                    "wind_wave_height": current.get("wind_wave_height", 0),
                    "ocean_current_velocity": current.get("ocean_current_velocity", 0),
                    "timestamp": datetime.utcnow()
                }
            else:
                print(f"Open-Meteo Marine API error: {response.status_code} - {response.text}")
                return None
        
        except Exception as e:
            print(f"Error fetching marine data: {e}")
            return None
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
