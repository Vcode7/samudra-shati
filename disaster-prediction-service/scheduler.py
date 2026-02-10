import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
from typing import List, Dict

from .config import settings
from .services.weather_client import WeatherClient
from .services.marine_client import MarineClient
from .services.predictor import DisasterPredictor


class PredictionScheduler:
    """Scheduler for periodic disaster predictions"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.weather_client = WeatherClient(settings.OPENWEATHER_API_KEY)
        self.marine_client = MarineClient()
        self.predictor = DisasterPredictor(settings)
        self.last_predictions: List[Dict] = []
    
    async def run_prediction_cycle(self):
        """
        Run a complete prediction cycle:
        1. Fetch weather + marine data for all locations
        2. Run prediction rules
        3. Send predictions to backend
        """
        print(f"\n[{datetime.now()}] Running prediction cycle...")
        
        locations = settings.prediction_locations_list
        all_predictions = []
        
        for location in locations:
            lat = location["lat"]
            lon = location["lon"]
            name = location["name"]
            
            print(f"  Checking {name} ({lat}, {lon})...")
            
            # Fetch data from APIs
            weather_data = await self.weather_client.get_current_weather(lat, lon)
            marine_data = await self.marine_client.get_marine_forecast(lat, lon)
            forecast_data = await self.weather_client.get_forecast(lat, lon)
            
            if weather_data:
                print(f"    Weather: {weather_data['temp']:.1f}°C, {weather_data['wind_speed']:.0f} km/h wind, {weather_data['pressure']:.0f} hPa")
            
            if marine_data:
                print(f"    Marine: {marine_data['wave_height']:.1f}m waves")
            
            if forecast_data:
                print(f"    Forecast: {forecast_data['total_rain_24h']:.0f}mm rain in 24h")
            
            # Run prediction analysis
            predictions = self.predictor.analyze(
                weather_data=weather_data,
                marine_data=marine_data,
                forecast_data=forecast_data,
                location_name=name,
                latitude=lat,
                longitude=lon
            )
            
            if predictions:
                print(f"    ⚠️  {len(predictions)} prediction(s) generated!")
                for pred in predictions:
                    print(f"      - {pred['type']} (severity {pred['severity']}, confidence {pred['confidence']})")
                
                all_predictions.extend(predictions)
        
        # Store predictions
        self.last_predictions = all_predictions
        
        # Send to backend
        if all_predictions:
            await self._send_to_backend(all_predictions)
        else:
            print("  No disaster risks detected.")
        
        print(f"[{datetime.now()}] Prediction cycle complete.\n")
    
    async def _send_to_backend(self, predictions: List[Dict]):
        """Send predictions to the main backend"""
        backend_url = f"{settings.BACKEND_URL}/api/predictions/early-warning"
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            for prediction in predictions:
                # Add timestamp
                prediction["predicted_at"] = datetime.utcnow().isoformat() + "Z"
                
                try:
                    response = await client.post(backend_url, json=prediction)
                    
                    if response.status_code in [200, 201]:
                        print(f"    ✓ Sent {prediction['type']} to backend")
                    else:
                        print(f"    ✗ Backend error for {prediction['type']}: {response.status_code}")
                        if settings.DEBUG:
                            print(f"      Response: {response.text}")
                
                except httpx.ConnectError:
                    print(f"    ✗ Cannot connect to backend at {settings.BACKEND_URL}")
                    print("      Make sure the main backend is running on port 8000")
                    break
                
                except Exception as e:
                    print(f"    ✗ Error sending prediction: {e}")
    
    def start(self):
        """Start the scheduler"""
        print(f"\n{'='*60}")
        print(f"  Disaster Prediction Scheduler Started")
        print(f"  Interval: {settings.PREDICTION_INTERVAL_MINUTES} minutes")
        print(f"  Monitoring {len(settings.prediction_locations_list)} location(s)")
        print(f"  Backend: {settings.BACKEND_URL}")
        print(f"{'='*60}\n")
        
        # Schedule the prediction cycle
        self.scheduler.add_job(
            self.run_prediction_cycle,
            trigger=IntervalTrigger(minutes=settings.PREDICTION_INTERVAL_MINUTES),
            id="prediction_cycle",
            replace_existing=True
        )
        
        self.scheduler.start()
    
    def stop(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
    
    def get_last_predictions(self) -> List[Dict]:
        """Get the most recent predictions"""
        return self.last_predictions


# Global instance
prediction_scheduler = PredictionScheduler()
