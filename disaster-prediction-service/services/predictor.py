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
    def _num(self, value, default=0.0):
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)

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
    
    def _check_coastal_storm(self, weather: Dict, marine: Dict, location: str) -> Optional[Dict]:

        wave_height = self._num(marine.get("wave_height"))
        wind_speed = self._num(weather.get("wind_speed"))

        if (wave_height > self.config.COASTAL_STORM_WAVE_HEIGHT_M and
            wind_speed > self.config.COASTAL_STORM_WIND_SPEED_KMH):

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
        total_rain = self._num(forecast.get("total_rain_24h"))

        if total_rain > self.config.FLOOD_RAINFALL_24H_MM:
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
        pressure = self._num(weather.get("pressure"), 1013)
        wind_speed = self._num(weather.get("wind_speed"))

        if (pressure < self.config.CYCLONE_PRESSURE_HPA and
            wind_speed > self.config.CYCLONE_WIND_SPEED_KMH):

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
        temp = self._num(weather.get("temp"))
        humidity = self._num(weather.get("humidity"))

        if (temp > self.config.HEATWAVE_TEMP_C and
            humidity > self.config.HEATWAVE_HUMIDITY_PERCENT):

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
        wave_height = self._num(marine.get("wave_height"))

        if wave_height > self.config.HIGH_WAVE_HEIGHT_M:
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

