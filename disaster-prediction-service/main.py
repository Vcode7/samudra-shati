from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from .config import settings
from .scheduler import prediction_scheduler


# Create FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME,
    description="AI-powered disaster prediction using weather and marine data",
    version=settings.SERVICE_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Start the prediction scheduler on app startup"""
    print(f"\n{'='*60}")
    print(f"  {settings.SERVICE_NAME} v{settings.SERVICE_VERSION}")
    print(f"  Starting on http://0.0.0.0:8001")
    print(f"{'='*60}\n")
    
    # Start the scheduler
    prediction_scheduler.start()
    
    # Run initial prediction cycle
    print("Running initial prediction cycle...")
    await prediction_scheduler.run_prediction_cycle()


@app.on_event("shutdown")
async def shutdown_event():
    """Stop the scheduler on shutdown"""
    print("\nShutting down prediction scheduler...")
    prediction_scheduler.stop()
    
    # Close API clients
    await prediction_scheduler.weather_client.close()
    await prediction_scheduler.marine_client.close()


@app.get("/")
async def root():
    """Service information"""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "status": "running",
        "description": "Disaster prediction microservice using weather and marine APIs",
        "endpoints": {
            "health": "/health",
            "trigger": "POST /trigger",
            "latest": "/predictions/latest",
            "docs": "/docs"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "service": settings.SERVICE_NAME,
        "prediction_interval_minutes": settings.PREDICTION_INTERVAL_MINUTES,
        "monitoring_locations": len(settings.prediction_locations_list)
    }


@app.post("/trigger")
async def trigger_prediction():
    """
    Manually trigger a prediction cycle (for demo/testing)
    
    This bypasses the scheduler and runs an immediate prediction.
    Useful for testing and demonstrations.
    """
    print("\n[MANUAL TRIGGER] Running prediction cycle...")
    await prediction_scheduler.run_prediction_cycle()
    
    return {
        "success": True,
        "message": "Prediction cycle triggered",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "predictions_generated": len(prediction_scheduler.last_predictions)
    }


@app.get("/predictions/latest")
async def get_latest_predictions():
    """
    Get the most recent predictions from the last cycle
    
    Returns:
        List of predictions with type, severity, confidence, etc.
    """
    predictions = prediction_scheduler.get_last_predictions()
    
    return {
        "count": len(predictions),
        "predictions": predictions,
        "last_run": datetime.utcnow().isoformat() + "Z"
    }


@app.get("/config")
async def get_config():
    """
    Get current configuration (for debugging)
    
    Note: API keys are masked
    """
    return {
        "backend_url": settings.BACKEND_URL,
        "prediction_interval_minutes": settings.PREDICTION_INTERVAL_MINUTES,
        "monitoring_locations": settings.prediction_locations_list,
        "thresholds": {
            "coastal_storm_wave_height_m": settings.COASTAL_STORM_WAVE_HEIGHT_M,
            "coastal_storm_wind_speed_kmh": settings.COASTAL_STORM_WIND_SPEED_KMH,
            "flood_rainfall_24h_mm": settings.FLOOD_RAINFALL_24H_MM,
            "cyclone_pressure_hpa": settings.CYCLONE_PRESSURE_HPA,
            "cyclone_wind_speed_kmh": settings.CYCLONE_WIND_SPEED_KMH,
            "heatwave_temp_c": settings.HEATWAVE_TEMP_C,
            "heatwave_humidity_percent": settings.HEATWAVE_HUMIDITY_PERCENT,
            "high_wave_height_m": settings.HIGH_WAVE_HEIGHT_M
        },
        "openweather_api_configured": bool(settings.OPENWEATHER_API_KEY)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG
    )
