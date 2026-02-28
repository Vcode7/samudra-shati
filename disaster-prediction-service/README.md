# 🌊 Disaster Prediction & Early Warning Service

An independent microservice that predicts coastal disasters using real-time weather and marine data from external APIs.

## 🎯 Features

- **Real-time Monitoring**: Fetches weather and marine data every 15 minutes (configurable)
- **Rule-Based Predictions**: Explainable AI using threshold-based rules
- **5 Disaster Types**:
  - `COASTAL_STORM_RISK` - High waves + strong winds
  - `FLOOD_RISK` - Heavy rainfall forecast
  - `CYCLONE_WATCH` - Low pressure + strong winds
  - `HEATWAVE_RISK` - Extreme heat + humidity
  - `HIGH_WAVE_ALERT` - Very high waves
- **Backend Integration**: Sends predictions to main Sankat Saathi backend
- **Multi-Location Support**: Monitor multiple coastal points

## 🔌 Data Sources

1. **OpenWeatherMap** (requires free API key)
   - Current weather (temperature, wind, pressure, humidity)
   - 5-day forecast (rainfall predictions)
   - Sign up: https://openweathermap.org/api

2. **Open-Meteo Marine** (free, no API key)
   - Wave height and direction
   - Swell data
   - Ocean current velocity

## 📦 Installation

### 1. Install Dependencies

```bash
cd e:\projects\samudar_shati\disaster-prediction-service
pip install -r requirements.txt
```

### 2. Configure Environment

Edit `.env` file and add your OpenWeatherMap API key:

```env
OPENWEATHER_API_KEY=your_actual_api_key_here
BACKEND_URL=http://localhost:8000
PREDICTION_INTERVAL_MINUTES=15
```

### 3. (Optional) Configure Multiple Locations

To monitor multiple coastal points, edit `.env`:

```env
PREDICTION_LOCATIONS=[{"lat":13.08,"lon":80.27,"name":"Chennai"},{"lat":8.08,"lon":77.54,"name":"Kanyakumari"}]
```

## 🚀 Usage

### Start the Service

```bash
python -m uvicorn main:app --port 8001 --reload
```

The service will:
- Start on `http://localhost:8001`
- Run an initial prediction cycle immediately
- Schedule predictions every 15 minutes
- Send warnings to the backend at `http://localhost:8000`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service information |
| `/health` | GET | Health check |
| `/docs` | GET | Interactive API documentation |
| `/trigger` | POST | Manually trigger a prediction cycle |
| `/predictions/latest` | GET | Get most recent predictions |
| `/config` | GET | View current configuration |

### Manual Trigger (for testing)

```bash
curl -X POST http://localhost:8001/trigger
```

### View Latest Predictions

```bash
curl http://localhost:8001/predictions/latest
```

## 🧠 Prediction Rules

### Coastal Storm Risk
- **Condition**: `wave_height > 3.5m AND wind_speed > 40 km/h`
- **Severity**: 7/10
- **Confidence**: 0.75-0.90 (scaled by magnitude)

### Flood Risk
- **Condition**: `rainfall_24h > 120mm`
- **Severity**: 6/10
- **Confidence**: 0.70-0.85

### Cyclone Watch
- **Condition**: `pressure < 990 hPa AND wind_speed > 50 km/h`
- **Severity**: 8/10
- **Confidence**: 0.80-0.95

### Heatwave Risk
- **Condition**: `temp > 42°C AND humidity > 60%`
- **Severity**: 5/10
- **Confidence**: 0.70-0.80

### High Wave Alert
- **Condition**: `wave_height > 4.5m`
- **Severity**: 6/10
- **Confidence**: 0.80-0.90

## 🔧 Configuration

All thresholds are configurable in `.env`:

```env
COASTAL_STORM_WAVE_HEIGHT_M=3.5
COASTAL_STORM_WIND_SPEED_KMH=40.0
FLOOD_RAINFALL_24H_MM=120.0
CYCLONE_PRESSURE_HPA=990.0
CYCLONE_WIND_SPEED_KMH=50.0
HEATWAVE_TEMP_C=42.0
HEATWAVE_HUMIDITY_PERCENT=60.0
HIGH_WAVE_HEIGHT_M=4.5
```

## 📊 Example Prediction Output

```json
{
  "type": "COASTAL_STORM_RISK",
  "latitude": 13.0827,
  "longitude": 80.2707,
  "severity": 7,
  "confidence": 0.82,
  "source_apis": ["open-meteo", "openweather"],
  "message": "High waves (4.2m) and strong winds (55 km/h) expected near Chennai Coast in next 6 hours. Stay away from coast.",
  "predicted_at": "2026-02-10T12:00:00Z",
  "valid_for_minutes": 360
}
```

## 🔗 Backend Integration

The service automatically sends predictions to:
```
POST http://localhost:8000/api/predictions/early-warning
```

Make sure the main Sankat Saathi backend is running on port 8000.

## 🐛 Troubleshooting

### "Cannot connect to backend"
- Ensure the main backend is running: `cd backend && python -m uvicorn app.main:app --port 8000`

### "OpenWeather API error: 401"
- Check that your API key is correct in `.env`
- Verify the key is activated (may take a few hours after signup)

### No predictions generated
- This is normal if weather conditions are calm
- Use `POST /trigger` to force a check
- Check threshold values in `.env` if needed

## 📝 Development

### Project Structure

```
disaster-prediction-service/
├── main.py                 # FastAPI application
├── config.py              # Configuration settings
├── scheduler.py           # APScheduler logic
├── services/
│   ├── weather_client.py  # OpenWeatherMap client
│   ├── marine_client.py   # Open-Meteo Marine client
│   └── predictor.py       # Prediction rules engine
├── .env                   # Environment variables
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

### Testing

1. Start the service
2. Trigger a manual prediction: `curl -X POST http://localhost:8001/trigger`
3. Check logs for predictions
4. View latest: `curl http://localhost:8001/predictions/latest`

## 🔒 Safety Features

- **No Auto-Emergency**: Predictions are marked as `ai_predicted=true` but do NOT automatically trigger emergency mode
- **Authority Verification Required**: Only authorities can verify and activate emergency mode
- **Transparent**: All predictions include confidence scores and source APIs
- **Configurable**: All thresholds can be adjusted

## 📄 License

Part of the Sankat Saathi project.
