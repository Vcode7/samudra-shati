from pydantic_settings import BaseSettings
from typing import List, Dict
import json


class Settings(BaseSettings):
    """Configuration settings for disaster prediction service"""
    
    # External API Keys
    OPENWEATHER_API_KEY: str = ""  # Required for OpenWeatherMap
    
    # Backend Integration
    BACKEND_URL: str = "http://localhost:8000"
    
    # Scheduler Configuration
    PREDICTION_INTERVAL_MINUTES: int = 15
    
    # Default monitoring location (Chennai coastal area)
    DEFAULT_LATITUDE: float = 13.0827
    DEFAULT_LONGITUDE: float = 80.2707
    DEFAULT_LOCATION_NAME: str = "Chennai Coast"
    
    # Multiple locations support (JSON string of array)
    # Example: [{"lat": 13.08, "lon": 80.27, "name": "Chennai"}, ...]
    PREDICTION_LOCATIONS: str = "[]"
    
    # Prediction thresholds (configurable)
    COASTAL_STORM_WAVE_HEIGHT_M: float = 3.5
    COASTAL_STORM_WIND_SPEED_KMH: float = 40.0
    
    FLOOD_RAINFALL_24H_MM: float = 120.0
    
    CYCLONE_PRESSURE_HPA: float = 990.0
    CYCLONE_WIND_SPEED_KMH: float = 50.0
    
    HEATWAVE_TEMP_C: float = 42.0
    HEATWAVE_HUMIDITY_PERCENT: float = 60.0
    
    HIGH_WAVE_HEIGHT_M: float = 4.5
    
    # Validity period for predictions (in minutes)
    DEFAULT_PREDICTION_VALIDITY_MINUTES: int = 360  # 6 hours
    
    # Service configuration
    SERVICE_NAME: str = "Disaster Prediction Service"
    SERVICE_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    @property
    def prediction_locations_list(self) -> List[Dict]:
        """Parse PREDICTION_LOCATIONS JSON string into list"""
        if not self.PREDICTION_LOCATIONS or self.PREDICTION_LOCATIONS == "[]":
            # Return default location
            return [{
                "lat": self.DEFAULT_LATITUDE,
                "lon": self.DEFAULT_LONGITUDE,
                "name": self.DEFAULT_LOCATION_NAME
            }]
        
        try:
            locations = json.loads(self.PREDICTION_LOCATIONS)
            return locations if locations else [{
                "lat": self.DEFAULT_LATITUDE,
                "lon": self.DEFAULT_LONGITUDE,
                "name": self.DEFAULT_LOCATION_NAME
            }]
        except json.JSONDecodeError:
            print("Warning: Invalid PREDICTION_LOCATIONS JSON, using default")
            return [{
                "lat": self.DEFAULT_LATITUDE,
                "lon": self.DEFAULT_LONGITUDE,
                "name": self.DEFAULT_LOCATION_NAME
            }]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
