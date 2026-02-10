import httpx
from typing import Dict, Optional
from datetime import datetime


class WeatherClient:
    """Client for OpenWeatherMap API"""
    
    BASE_URL = "https://api.openweathermap.org/data/2.5"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def get_current_weather(self, lat: float, lon: float) -> Optional[Dict]:
        """
        Get current weather data for a location
        
        Returns:
            {
                "temp": float (Celsius),
                "humidity": float (percentage),
                "pressure": float (hPa),
                "wind_speed": float (km/h),
                "weather_main": str,
                "weather_description": str,
                "timestamp": datetime
            }
        """
        if not self.api_key:
            print("Warning: No OpenWeather API key provided")
            return None
        
        url = f"{self.BASE_URL}/weather"
        params = {
            "lat": lat,
            "lon": lon,
            "appid": self.api_key,
            "units": "metric"  # Celsius, m/s
        }
        
        try:
            response = await self.client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                
                # Convert wind speed from m/s to km/h
                wind_speed_kmh = data.get("wind", {}).get("speed", 0) * 3.6
                
                return {
                    "temp": data.get("main", {}).get("temp", 0),
                    "humidity": data.get("main", {}).get("humidity", 0),
                    "pressure": data.get("main", {}).get("pressure", 1013),
                    "wind_speed": wind_speed_kmh,
                    "weather_main": data.get("weather", [{}])[0].get("main", "Unknown"),
                    "weather_description": data.get("weather", [{}])[0].get("description", ""),
                    "timestamp": datetime.utcnow()
                }
            else:
                print(f"OpenWeather API error: {response.status_code} - {response.text}")
                return None
        
        except Exception as e:
            print(f"Error fetching current weather: {e}")
            return None
    
    async def get_forecast(self, lat: float, lon: float) -> Optional[Dict]:
        """
        Get 5-day forecast data
        
        Returns:
            {
                "forecasts": [
                    {
                        "dt": datetime,
                        "temp": float,
                        "rain_3h": float (mm),
                        "wind_speed": float (km/h),
                        "pressure": float (hPa)
                    },
                    ...
                ],
                "total_rain_24h": float (mm)
            }
        """
        if not self.api_key:
            print("Warning: No OpenWeather API key provided")
            return None
        
        url = f"{self.BASE_URL}/forecast"
        params = {
            "lat": lat,
            "lon": lon,
            "appid": self.api_key,
            "units": "metric"
        }
        
        try:
            response = await self.client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                forecasts = []
                total_rain_24h = 0.0
                
                # Process forecast list (3-hour intervals)
                for item in data.get("list", [])[:8]:  # First 8 = 24 hours
                    dt = datetime.fromtimestamp(item.get("dt", 0))
                    rain_3h = item.get("rain", {}).get("3h", 0)
                    wind_speed_kmh = item.get("wind", {}).get("speed", 0) * 3.6
                    
                    forecasts.append({
                        "dt": dt,
                        "temp": item.get("main", {}).get("temp", 0),
                        "rain_3h": rain_3h,
                        "wind_speed": wind_speed_kmh,
                        "pressure": item.get("main", {}).get("pressure", 1013)
                    })
                    
                    total_rain_24h += rain_3h
                
                return {
                    "forecasts": forecasts,
                    "total_rain_24h": total_rain_24h
                }
            else:
                print(f"OpenWeather Forecast API error: {response.status_code}")
                return None
        
        except Exception as e:
            print(f"Error fetching forecast: {e}")
            return None
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()
