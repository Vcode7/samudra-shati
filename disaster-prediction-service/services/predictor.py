from typing import Dict, List, Optional
from datetime import datetime


class DisasterPredictor:
    """Rule-based disaster prediction engine"""
    
    def __init__(self, config):
        """
        Initialize with configuration thresholds
        
        Args:
            config: Settings object with threshold values
        """
        self.config = config
    
    def analyze(
        self,
        weather_data: Optional[Dict],
        marine_data: Optional[Dict],
        forecast_data: Optional[Dict],
        location_name: str,
        latitude: float,
        longitude: float
    ) -> List[Dict]:
        """
        Analyze weather and marine data to predict disasters
        
        Returns:
            List of predictions, each containing:
            {
                "type": str,
                "severity": int (1-10),
                "confidence": float (0-1),
                "source_apis": list[str],
                "message": str,
                "latitude": float,
                "longitude": float,
                "valid_for_minutes": int
            }
        """
        predictions = []
        
        # Check for coastal storm risk
        if weather_data and marine_data:
            coastal_storm = self._check_coastal_storm(
                weather_data, marine_data, location_name
            )
            if coastal_storm:
                coastal_storm["latitude"] = latitude
                coastal_storm["longitude"] = longitude
                predictions.append(coastal_storm)
        
        # Check for flood risk
        if forecast_data:
            flood_risk = self._check_flood_risk(forecast_data, location_name)
            if flood_risk:
                flood_risk["latitude"] = latitude
                flood_risk["longitude"] = longitude
                predictions.append(flood_risk)
        
        # Check for cyclone watch
        if weather_data:
            cyclone_watch = self._check_cyclone(weather_data, location_name)
            if cyclone_watch:
                cyclone_watch["latitude"] = latitude
                cyclone_watch["longitude"] = longitude
                predictions.append(cyclone_watch)
        
        # Check for heatwave risk
        if weather_data:
            heatwave = self._check_heatwave(weather_data, location_name)
            if heatwave:
                heatwave["latitude"] = latitude
                heatwave["longitude"] = longitude
                predictions.append(heatwave)
        
        # Check for high wave alert
        if marine_data:
            high_wave = self._check_high_wave(marine_data, location_name)
            if high_wave:
                high_wave["latitude"] = latitude
                high_wave["longitude"] = longitude
                predictions.append(high_wave)
        
        return predictions
    
    def _check_coastal_storm(
        self, weather: Dict, marine: Dict, location: str
    ) -> Optional[Dict]:
        """
        COASTAL_STORM_RISK:
        wave_height > 3.5m AND wind_speed > 40 km/h
        Severity: 7, Confidence: 0.75-0.90 (scaled)
        """
        wave_height = marine.get("wave_height", 0)
        wind_speed = weather.get("wind_speed", 0)
        
        if (wave_height > self.config.COASTAL_STORM_WAVE_HEIGHT_M and
            wind_speed > self.config.COASTAL_STORM_WIND_SPEED_KMH):
            
            # Scale confidence based on magnitude
            wave_excess = (wave_height - self.config.COASTAL_STORM_WAVE_HEIGHT_M) / 2.0
            wind_excess = (wind_speed - self.config.COASTAL_STORM_WIND_SPEED_KMH) / 30.0
            confidence = min(0.75 + (wave_excess + wind_excess) * 0.15, 0.90)
            
            return {
                "type": "COASTAL_STORM_RISK",
                "severity": 7,
                "confidence": round(confidence, 2),
                "source_apis": ["open-meteo", "openweather"],
                "message": f"High waves ({wave_height:.1f}m) and strong winds ({wind_speed:.0f} km/h) expected near {location} in next 6 hours. Stay away from coast.",
                "valid_for_minutes": self.config.DEFAULT_PREDICTION_VALIDITY_MINUTES
            }
        
        return None
    
    def _check_flood_risk(self, forecast: Dict, location: str) -> Optional[Dict]:
        """
        FLOOD_RISK:
        rainfall_24h > 120mm
        Severity: 6, Confidence: 0.70-0.85
        """
        total_rain = forecast.get("total_rain_24h", 0)
        
        if total_rain > self.config.FLOOD_RAINFALL_24H_MM:
            # Scale confidence
            excess = (total_rain - self.config.FLOOD_RAINFALL_24H_MM) / 80.0
            confidence = min(0.70 + excess * 0.15, 0.85)
            
            return {
                "type": "FLOOD_RISK",
                "severity": 6,
                "confidence": round(confidence, 2),
                "source_apis": ["openweather"],
                "message": f"Heavy rainfall ({total_rain:.0f}mm) expected in {location} within 24 hours. Risk of flooding in low-lying areas.",
                "valid_for_minutes": self.config.DEFAULT_PREDICTION_VALIDITY_MINUTES
            }
        
        return None
    
    def _check_cyclone(self, weather: Dict, location: str) -> Optional[Dict]:
        """
        CYCLONE_WATCH:
        pressure < 990 hPa AND wind_speed > 50 km/h
        Severity: 8, Confidence: 0.80-0.95
        """
        pressure = weather.get("pressure", 1013)
        wind_speed = weather.get("wind_speed", 0)
        
        if (pressure < self.config.CYCLONE_PRESSURE_HPA and
            wind_speed > self.config.CYCLONE_WIND_SPEED_KMH):
            
            # Scale confidence
            pressure_drop = (1013 - pressure) / 50.0
            wind_excess = (wind_speed - self.config.CYCLONE_WIND_SPEED_KMH) / 40.0
            confidence = min(0.80 + (pressure_drop + wind_excess) * 0.075, 0.95)
            
            return {
                "type": "CYCLONE_WATCH",
                "severity": 8,
                "confidence": round(confidence, 2),
                "source_apis": ["openweather"],
                "message": f"Low pressure ({pressure:.0f} hPa) and strong winds ({wind_speed:.0f} km/h) detected near {location}. Possible cyclone formation.",
                "valid_for_minutes": self.config.DEFAULT_PREDICTION_VALIDITY_MINUTES
            }
        
        return None
    
    def _check_heatwave(self, weather: Dict, location: str) -> Optional[Dict]:
        """
        HEATWAVE_RISK:
        temp > 42°C AND humidity > 60%
        Severity: 5, Confidence: 0.70-0.80
        """
        temp = weather.get("temp", 0)
        humidity = weather.get("humidity", 0)
        
        if (temp > self.config.HEATWAVE_TEMP_C and
            humidity > self.config.HEATWAVE_HUMIDITY_PERCENT):
            
            # Scale confidence
            temp_excess = (temp - self.config.HEATWAVE_TEMP_C) / 5.0
            confidence = min(0.70 + temp_excess * 0.10, 0.80)
            
            return {
                "type": "HEATWAVE_RISK",
                "severity": 5,
                "confidence": round(confidence, 2),
                "source_apis": ["openweather"],
                "message": f"Extreme heat ({temp:.1f}°C) with high humidity ({humidity:.0f}%) in {location}. Risk of heat-related illness.",
                "valid_for_minutes": self.config.DEFAULT_PREDICTION_VALIDITY_MINUTES
            }
        
        return None
    
    def _check_high_wave(self, marine: Dict, location: str) -> Optional[Dict]:
        """
        HIGH_WAVE_ALERT:
        wave_height > 4.5m
        Severity: 6, Confidence: 0.80
        """
        wave_height = marine.get("wave_height", 0)
        
        if wave_height > self.config.HIGH_WAVE_HEIGHT_M:
            # Scale confidence slightly
            excess = (wave_height - self.config.HIGH_WAVE_HEIGHT_M) / 2.0
            confidence = min(0.80 + excess * 0.10, 0.90)
            
            return {
                "type": "HIGH_WAVE_ALERT",
                "severity": 6,
                "confidence": round(confidence, 2),
                "source_apis": ["open-meteo"],
                "message": f"Very high waves ({wave_height:.1f}m) near {location}. Dangerous for fishing boats and coastal activities.",
                "valid_for_minutes": self.config.DEFAULT_PREDICTION_VALIDITY_MINUTES
            }
        
        return None
