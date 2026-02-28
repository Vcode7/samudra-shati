# 🌊 Sankat Saathi - Coastal Disaster Alert System

**A comprehensive disaster management platform for coastal communities with real-time alerts, AI predictions, and community-driven verification.**

---

## 📋 Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Feature Documentation](#feature-documentation)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)

---

## 🎯 Overview

Sankat Saathi is an intelligent disaster alert and management system designed specifically for coastal areas. It combines AI-powered predictions, community verification, and real-time emergency response to save lives during natural disasters like cyclones, floods, and tsunamis.

**Core Objectives:**
- Provide early warnings for coastal disasters
- Enable rapid community-driven disaster reporting
- Facilitate efficient evacuation and emergency response
- Support multi-language communication for diverse populations
- Empower authorities with real-time crisis management tools

---

## 🚀 Key Features

### 1. **Multi-Language Support (22 Indian Languages)**
The system supports comprehensive internationalization for India's diverse linguistic landscape.

**Supported Languages:**
- **Coastal**: English, Tamil, Malayalam, Kannada, Tulu, Telugu, Konkani
- **Northern**: Hindi, Punjabi, Urdu, Hindi-English (Hinglish)
- **Eastern**: Bengali, Odia, Assamese
- **Western**: Gujarati, Marathi
- **Northeastern**: Bodo, Manipuri, Dogri
- **Other**: Bhojpuri, Kashmiri, Maithili, Rajasthani, Santali, Sindhi

**How It Works:**
- Users select primary and optional secondary language during onboarding
- All alerts are announced in BOTH selected languages via text-to-speech
- Push notifications contain translations in all supported languages
- UI dynamically updates based on language preference
- Voice alerts use native TTS for better comprehension

**Use Cases:**
- Fisher communities receive alerts in Tamil/Malayalam
- Tourists get alerts in English
- Elderly receive dual-language support for clarity
- Multi-generational families can use different preferences

---

### 2. **Phone Number Verification (OTP)**
Secure user authentication using SMS-based OTP verification.

**Implementation:**
- 6-digit OTP sent via Twilio SMS gateway
- 5-minute expiry for security
- Max 3 verification attempts
- Automatic user account creation/linking
- Device registration upon successful verification

**Technical Details:**
```python
# OTP Generation
- Random 6-digit code
- Stored with bcrypt hashing
- Linked to phone number and device ID
- Expires after 5 minutes

# SMS Integration (Twilio)
- Real-time SMS delivery
- Configurable sender number
- International format support (+CountryCode)
```

**User Flow:**
1. Enter 10-digit phone number
2. Receive SMS with OTP
3. Enter 6-digit code
4. Account created/verified
5. Device linked to user profile

---

### 3. **Emergency Call System**
One-tap emergency calling to nearest authorities with location sharing.

**Features:**
- **Nearest Authority Detection**: GPS-based routing to closest help
- **Authority Types**: Police, Fire, Medical, Coast Guard, NDRF
- **Location Sharing**: Real-time GPS coordinates shared during call
- **Call Logging**: All emergency calls tracked in database
- **Stop Sharing**: Manual control to end location broadcast

**How It Works:**
```typescript
1. User taps "📞 Call for Help" button
2. System finds nearest authority (within 50km)
3. Shows authority details (name, type, distance)
4. User confirms and initiates call
5. Location shared in real-time via heartbeat API
6. Call logged with timestamp and coordinates
```

**API Endpoints:**
- `/api/authorities/nearest` - Find closest authority
- `/api/authorities/emergency-call` - Log call details
- `/api/authorities/emergency-call/{id}/stop-sharing` - End tracking

---

### 4. **AI Early Warning System**
Machine learning-powered disaster prediction using weather data.

**Data Sources:**
- **Open-Meteo Marine API**: Wave height, swell, ocean currents
- **OpenWeather API**: Temperature, pressure, wind speed, humidity
- **Historical Patterns**: Past disaster data analysis

**Prediction Algorithm:**
```python
def predict_disaster(weather_data, marine_data):
    # Risk calculation based on:
    - Wave height > 4m → Coastal flood risk
    - Wind speed > 60 km/h → Storm risk  
    - Pressure drop < 1000 hPa → Cyclone risk
    - Temperature anomalies → Heat/cold wave
    - Swell period patterns → Tsunami indicators
    
    # Confidence scoring (0-100%)
    confidence = calculate_weighted_scores(all_factors)
    
    # Severity rating (1-10)
    severity = map_to_severity_scale(risk_level)
    
    return Prediction(type, confidence, severity, message)
```

**Prediction Types:**
- Coastal Storm Risk
- Flood Risk
- Cyclone Formation
- Tsunami Warning
- Heat Wave Alert

**Notification Flow:**
1. AI service runs predictions every 30 minutes
2. High-confidence predictions (>60%) sent to backend
3. Backend validates and stores prediction
4. Sends notifications to users within 50km
5. Alerts authorities for verification
6. Displays in app's "AI Early Warnings" section

---

### 5. **Community Disaster Reporting**
Crowdsourced disaster verification system.

**Reporting Process:**
```
User → Upload Photo/Video → Add Description → 
GPS Location Captured → Submit → 
Broadcast to Nearby Users → Community Verification
```

**Verification Mechanism:**
- **Nearby Users**: Within 10km receive verification request
- **30-Minute Window**: Users can verify within 30 minutes
- **Binary Response**: "I confirm this disaster" or "I haven't seen this"
- **Threshold**: 5 confirmations = VERIFIED status
- **Rejection**: More rejections than confirmations = FALSE_ALARM

**Trust Score System:**
- Users start with 100 trust score
- Correct reports: +5 trust
- False reports: -10 trust
- Verification participation: +2 trust
- Weighted voting based on trust score

**API Workflow:**
```http
POST /api/disasters/upload
→ Creates disaster report (status: PENDING)
→ Triggers nearby user notifications

POST /api/disasters/{id}/verify  
Request: { "is_real": true/false }
→ Records user response
→ Updates verification counts
→ Changes status if threshold met
```

---

### 6. **Shake-to-Report (Emergency Camera)**
Automatic 5-second video recording triggered by phone shake.

**Implementation:**
- **Accelerometer Detection**: Monitors shake gestures
- **Threshold**: 3.5g acceleration spike
- **Auto-Record**: Immediate 5-second video capture
- **Auto-Upload**: Uploads to backend as emergency report
- **Location Tagging**: GPS coordinates embedded

**Use Case:**
*During sudden disasters (earthquake, building collapse), users may not have time to manually report. Shaking phone triggers instant documentation.*

**Technical Details:**
```typescript
// Shake Detection
sensitivity = 3.5; // g-force threshold
sampling_rate = 100ms;

onShakeDetected() {
  navigation.navigate('EmergencyCamera');
  startRecording(duration: 5000ms);
  onRecordingComplete(video) {
    uploadEmergencyReport(video, location, timestamp);
  }
}
```

---

### 7. **Emergency Mode**
Continuous alerting system when user enters danger zone.

**Activation Triggers:**
- User within disaster danger radius (configurable per event)
- Verified disaster with severity ≥ 7
- Community verification count ≥ 5

**Features:**
- **Continuous Vibration**: SOS pattern (3 short, 3 long, 3 short)
- **Voice Announcements**: Repeating evacuation instructions
- **Screen Overlay**: Fullscreen emergency warning
- **Exit Detection**: Auto-stops when user leaves danger zone
- **Manual Control**: Silence/resume vibration

**Distance Calculation:**
```python
danger_radius = disaster.danger_radius_km # e.g., 5km
user_distance = calculate_gps_distance(user_location, disaster_location)

if user_distance <= danger_radius:
    activate_emergency_mode()
```

---

### 8. **Evacuation Guidance**
AI-powered crowd movement analysis for safe routes.

**Algorithms:**

**A. Nearest Safe Area Routing**
```python
def find_safe_area(user_location, disaster_zones):
    safe_areas = get_all_safe_areas()
    # Filter areas outside all danger zones
    valid_areas = [area for area in safe_areas 
                   if not in_danger_zone(area, disaster_zones)]
    # Return nearest valid area
    return min(valid_areas, key=lambda a: distance(user_location, a))
```

**B. Crowd Movement Analysis**
```python
def analyze_crowd_movement(recent_locations):
    # Collect device locations from last 10 minutes
    # Calculate average movement direction
    vectors = [location.bearing for location in recent_locations]
    avg_direction = circular_mean(vectors)
    
    # Confidence based on consensus
    confidence = calculate_consensus(vectors)
    
    if confidence > 0.65:
        return {"direction": avg_direction, "confidence": confidence}
```

**Display Format:**
```
🚶 Community Evacuation Route
→ Head NORTH-EAST
📏 2.3 km away
⏱️ Approx 35 min walk
🎯 85% confidence (based on 47 people moving)
```

---

### 9. **Real-Time Disaster Map**
Interactive map showing all disasters, authorities, and safe zones.

**Map Layers:**
- **Danger Zones**: Red circles (radius = danger_radius_km)
- **Authorities**: Blue markers with type icons
- **Safe Areas**: Green circles (evacuation points)
- **User Location**: Blue dot with accuracy radius
- **AI Predictions**: Purple markers

**Dynamic Features:**
- Tap markers for detailed info
- Toggle layers on/off
- Auto-zoom to fit all disasters
- Distance calculations from user
- Color-coded severity (red=critical, orange=high, yellow=moderate)

**Data Refresh:**
- Auto-refresh every 30 seconds
- Pull-to-refresh manual update
- WebSocket for real-time updates

---

### 10. **Push Notifications**
Multi-channel alert delivery system.

**Notification Types:**

| Type | Priority | Sound | Vibration | Use Case |
|------|----------|-------|-----------|----------|
| Disaster Alert | HIGH | Alarm | SOS Pattern | New verified disaster |
| Verification Request | HIGH | Default | Short | Nearby event needs confirmation |
| AI Prediction | HIGH | Alert | Medium | Early warning detected |
| Evacuation Route | CRITICAL | Loud | Continuous | Crowd movement update |
| Emergency Active | CRITICAL | Siren | SOS Loop | Entered danger zone |

**Expo Push Integration:**
```typescript
// Token Registration
await Notifications.requestPermissionsAsync();
const token = await Notifications.getExpoPushTokenAsync();
await registerDevice(token);

// Notification Handling
Notifications.addNotificationReceivedListener((notification) => {
  const { type, disaster_id, messages } = notification.data;
  if (type === 'emergency_active') {
    activateEmergencyMode(disaster_id);
  }
});
```

**Multilingual Messaging:**
```json
{
"en": {"title": "Emergency Alert", "body": "Cyclone approaching..."},
  "hi": {"title": "आपातकालीन चेतावनी", "body": "चक्रवात आ रहा है..."},
  "ta": {"title": "அவசர எச்சரிக்கை", "body": "சூறாவளி வருகிறது..."}
}
```

---

### 11. **Authority Dashboard**
Web-based control panel for disaster authorities.

**Features:**

**A. Equipment Management**
- Add/Edit rescue equipment (boats, ambulances, helicopters)
- Mark availability status
- Location tracking
- Deployment history

**B. Safe Area Management**
- Create evacuation zones (shelters, high ground)
- Set capacity and facilities
- Update status (active/full/closed)
- Map visualization

**C. Disaster Monitoring**
- View all active disasters
- Verify/reject reports
- Update severity levels
- Close resolved incidents

**D. Emergency Call Dashboard**
- Live incoming emergency calls
- Caller location on map
- Response status tracking
- Call history logs

**E. AI Prediction Management**
- Review pending predictions
- Verify or cancel warnings
- Trigger manual alerts
- Historical accuracy metrics

---

### 12. **Heartbeat Location Tracking**
Privacy-preserving location monitoring.

**Design Principles:**
- **Privacy First**: Only stores LAST location, not history
- **Anonymous**: Device ID hashed for anonymity
- **Battery Efficient**: Updates every 5 minutes (configurable)
- **Offline Resilient**: Queues updates when offline

**Data Stored:**
```json
{
  "device_id_hash": "sha256(device_uuid)",
  "last_latitude": 13.0827,
  "last_longitude": 80.2707,
  "last_seen_at": "2026-02-11T09:00:00Z",
  "battery_level": 65,
  "network_status": "online"
}
```

**Use Cases:**
- Detect region-wide disconnections (disaster indicator)
- Crowd movement analysis
- Evacuation route suggestions
- Emergency response coordination

---

### 13. **Disconnect Detection**
AI-powered anomaly detection for mass outages.

**Algorithm:**
```python
def detect_region_disconnect(region_id):
    # Get recent heartbeats in 500km radius
    devices = get_active_devices(region_id)
    online_count = devices.filter(last_seen > 5_minutes_ago).count()
    
    # Calculate online percentage
    online_rate = online_count / total_devices
    
    # Trigger alert if <20% online (normal >95%)
    if online_rate < 0.20:
        create_disconnect_alert(
            region=region_id,
            severity="CRITICAL",
            affected_devices=total_devices - online_count
        )
        notify_authorities()
```

**Indicators:**
- >80% devices offline in region
- Sudden drop in heartbeat frequency
- Clustered disconnections (spatial pattern)
-Network status change (online → offline)

---

## 🏗️ System Architecture

```
┌─────────────────┐
│  Mobile App     │ (React Native + Expo)
│  - User Reports │
│  - Notifications│
│  - Maps         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FastAPI        │ (Python Backend)
│  Backend        │
│  - REST APIs    │
│  - Auth         │
│  - Database     │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┬───────────┐
    ▼         ▼              ▼           ▼
┌────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐
│ SQLite │ │ Weather  │ │ Twilio  │ │  Disaster  │
│   DB   │ │   APIs   │ │   SMS   │ │ Prediction │
└────────┘ └──────────┘ └─────────┘ │  Service   │
                                    └────────────┘
```

---

## 💻 Technology Stack

### **Frontend (Mobile)**
- **Framework**: React Native 0.81.5
- **Platform**: Expo SDK 54
- **Language**: TypeScript
- **Navigation**: React Navigation 7
- **Maps**: React Native Maps
- **Notifications**: Expo Notifications
- **State**: React Context API
- **Storage**: AsyncStorage
- **HTTP**: Axios

### **Backend (API Server)**
- **Framework**: FastAPI
- **Language**: Python 3.9+
- **Database**: SQLite (SQLAlchemy ORM)
- **Authentication**: JWT
- **SMS**: Twilio
- **Rate Limiting**: SlowAPI
- **Validation**: Pydantic

### **AI/ML Service**
- **Language**: Python
- **Scheduler**: APScheduler
- **APIs**: Open-Meteo, OpenWeather
- **HTTP Client**: httpx
- **Data Processing**: NumPy, Pandas

### **Authority Dashboard**
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Maps**: Google Maps API

---

## 🚀 Getting Started

### **Prerequisites**
```bash
- Node.js 18+
- Python 3.9+
- Expo CLI
- Android Studio (for Android)
- Twilio Account (for SMS)
```

### **Installation**

#### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Create .env file
echo "DATABASE_URL=sqlite:///./Sankat_saathi.db
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=your_number
SECRET_KEY=your_secret_key" > .env

# Run migrations
python -m app.database

# Start server
uvicorn app.main:app --reload
```

#### 2. Mobile App Setup
```bash
cd frontend
npm install

# Start Expo
npx expo start

# Run on Android
npx expo run:android
```

#### 3. AI Service Setup
```bash
cd disaster-prediction-service
pip install -r requirements.txt

# Add OpenWeather API key to config
python main.py
```

#### 4. Authority Dashboard
```bash
cd authority-dashboard-web
npm install
npm run dev
```

---

## 📊 API Documentation

Once backend is running, visit:
- **Swagger UI**: `http://localhost:8000/api/docs`
- **ReDoc**: `http://localhost:8000/api/redoc`

---

## 🔐 Security Features

✅ JWT-based authentication  
✅ Phone number verification (OTP)  
✅ Rate limiting on all endpoints  
✅ SQL injection prevention (SQLAlchemy ORM)  
✅ CORS protection  
✅ Input validation (Pydantic)  
✅ Password hashing (bcrypt)  
✅ Device ID hashing (anonymization)  

---

## 📱 Supported Platforms

- ✅ Android 5.0+ (API 21+)
- ✅ iOS 13.0+
- ✅ Web (Authority Dashboard)

---

## 🤝 Contributing

This is a disaster management system. Contributions welcome for:
- Additional language translations
- ML model improvements
- UI/UX enhancements
- Bug fixes and optimizations

---

## 📄 License

MIT License - See LICENSE file

---

## 👥 Team

Developed for coastal disaster management in India.

---

## 📞 Support

For issues or questions, please create an issue in the repository.

---

**🌊 Sankat Saathi - Protecting Coastal Communities Through Technology**
