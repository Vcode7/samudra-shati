# 🌊 samudra saathi (Ocean Alert)

**Disaster Alert and Reporting System for Rural Coastal Communities in India**

A production-ready mobile and backend system designed to save lives by providing real-time disaster alerts with voice announcements, vibration patterns, and community-based verification.

## 🎯 Project Overview

samudra saathi is a comprehensive disaster management system built specifically for rural coastal users in India. The system features:

- **Multi-language voice alerts** (English, Hindi, Tamil)
- **Background notifications** (works when app is closed)
- **Community verification** system for disaster reports
- **Authority management** for emergency services
- **Trust scoring** to prevent false alarms
- **Mock AI integration** ready for future enhancement

## 🏗️ Architecture

### Backend (FastAPI + PostgreSQL)
- RESTful API with JWT authentication
- Phone number OTP verification (mock service)
- Image upload with mock AI analysis
- Push notification distribution
- Geospatial alert targeting
- Trust score management

### Frontend (React Native + Expo)
- Cross-platform (iOS & Android)
- Background notification handling
- Dual-language Text-to-Speech
- Emergency vibration patterns
- Location services
- Image capture and upload

## 📁 Project Structure

```
samudar_shati/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI app entry
│   │   ├── models.py       # Database models
│   │   ├── schemas.py      # Pydantic schemas
│   │   ├── auth.py         # Authentication utilities
│   │   ├── routes/         # API endpoints
│   │   │   ├── users.py
│   │   │   ├── authorities.py
│   │   │   └── disasters.py
│   │   └── services/       # Business logic
│   │       ├── otp_service.py
│   │       ├── image_service.py
│   │       ├── notification_service.py
│   │       └── alert_service.py
│   ├── requirements.txt
│   └── README.md
│
└── frontend/               # React Native app
    ├── App.tsx            # Main app component
    ├── src/
    │   ├── context/       # React contexts
    │   │   ├── AuthContext.tsx
    │   │   └── LanguageContext.tsx
    │   ├── services/      # API & device services
    │   │   ├── api.ts
    │   │   ├── notificationService.ts
    │   │   ├── voiceService.ts
    │   │   ├── vibrationService.ts
    │   │   └── locationService.ts
    │   └── screens/       # App screens
    │       ├── LanguageSelectionScreen.tsx
    │       ├── OTPVerificationScreen.tsx
    │       └── HomeScreen.tsx
    ├── package.json
    └── README.md
```

## 🚀 Quick Start

### Prerequisites

**Backend:**
- Python 3.9+
- PostgreSQL (or SQLite for development)

**Frontend:**
- Node.js 16+
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Run server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: http://localhost:8000
API Docs: http://localhost:8000/api/docs

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your backend URL
# For Android emulator: API_BASE_URL=http://10.0.2.2:8000
# For iOS simulator: API_BASE_URL=http://localhost:8000
# For physical device: API_BASE_URL=http://YOUR_COMPUTER_IP:8000

# Start Expo
npm start
```

Then press:
- `a` for Android emulator
- `i` for iOS simulator
- Scan QR code with Expo Go app for physical device

## ✨ Key Features

### 1. Language Selection (First Launch)
- User selects primary language (required)
- Optional secondary language
- All alerts play in both languages via TTS

### 2. Phone Verification
- OTP-based verification (mock SMS service)
- JWT token authentication
- Persistent login

### 3. Disaster Reporting
- Upload image (camera or gallery)
- Auto-capture location
- Mock AI analysis (integration point marked)
- Automatic alert distribution to:
  - Nearby users (verification request)
  - Relevant authorities (disaster alert)

### 4. Alert System
**Works in all app states:**
- ✅ App in foreground
- ✅ App in background
- ✅ App completely closed

**Alert includes:**
- 📱 Push notification
- 🔊 Voice announcement (dual language)
- 📳 Emergency vibration pattern

### 5. Community Verification
- Nearby users receive verification requests
- Yes/No response system
- Trust score impact
- Automatic status updates

### 6. Authority Management
- Secure login for emergency services
- Equipment inventory tracking
- Operational radius configuration
- Automatic alert routing

### 7. Trust Scoring
- Initial score: 100
- Decreases for false alarms
- Users blocked below threshold
- Prevents abuse

## 🔧 Mock Services (Ready for Integration)

### OTP Service
**Current:** Logs OTP to console  
**Integration Point:** `backend/app/services/otp_service.py`

```python
# TODO: Replace with real SMS provider (Twilio, MSG91, etc.)
# Example: twilio_client.messages.create(to=phone_number, body=f"Your OTP is: {otp_code}")
```

### AI Image Analysis
**Current:** Returns mock hazard detection  
**Integration Point:** `backend/app/services/image_service.py`

```python
# TODO: Replace with actual AI model integration
# - Load trained disaster detection model
# - Preprocess image
# - Run inference
# - Return classification results
```

## 📱 Testing

### Test Alert Feature
1. Login to app
2. Go to Home screen
3. Tap "Test Alert" button
4. Verify:
   - Voice plays in both languages
   - Vibration pattern triggers
   - Notification appears

### Test Disaster Flow
1. Backend: Start server
2. Frontend: Login as User A
3. Upload disaster report
4. Backend: Check console for mock AI analysis
5. Frontend: Login as User B (different device/emulator)
6. User B receives verification request
7. User B responds Yes/No
8. Check disaster status updates

## 🎨 UI/UX Design Principles

- **Large buttons** for easy tapping
- **High contrast** for sunlight visibility
- **Minimal text** with icons
- **Voice-first** for low literacy
- **Simple navigation** for elderly users

## 📊 Database Schema

### Core Tables
- `users` - Phone auth, language prefs, trust score
- `authorities` - Emergency services, equipment
- `disaster_reports` - Images, location, AI analysis
- `verification_responses` - Community verification
- `alert_logs` - Notification delivery tracking
- `trust_scores` - User credibility history

## 🔐 Security

- JWT token authentication
- Phone number verification
- Rate limiting (SlowAPI)
- Password hashing (bcrypt)
- Device ID tracking
- Audit logs for authorities

## 🌍 Supported Languages

- **English** (en)
- **Hindi** (hi) - हिन्दी
- **Tamil** (ta) - தமிழ்

*Telugu and Malayalam can be easily added by extending translation dictionaries*

## 📈 Future Enhancements

### Phase 2 (Post-Foundation)
- [ ] Integrate real AI image analysis model
- [ ] Add real SMS provider (Twilio/MSG91)
- [ ] Implement offline SMS fallback
- [ ] Add government dashboard
- [ ] Optimize for low network areas
- [ ] Add offline data sync

### Phase 3 (Advanced)
- [ ] WebSocket for real-time updates
- [ ] Heat maps of disaster zones
- [ ] Predictive analytics
- [ ] Integration with weather APIs
- [ ] Multi-region support
- [ ] Advanced trust algorithms

## 🐛 Known Limitations

1. **Geospatial Queries:** Currently uses simple distance calculation. Production should use PostGIS.
2. **Image Storage:** Local storage. Production should use S3/CloudFront.
3. **OTP Service:** Mock implementation. Needs real SMS provider.
4. **AI Analysis:** Placeholder. Needs trained model.
5. **Remaining Screens:** Several frontend screens need completion (marked in App.tsx).

## 📝 API Documentation

Full API documentation available at: http://localhost:8000/api/docs

### Key Endpoints

**Users:**
- `POST /api/users/request-otp` - Request OTP
- `POST /api/users/verify-otp` - Verify & login
- `GET /api/users/me` - Get profile
- `GET /api/users/trust-score` - Get trust score

**Disasters:**
- `POST /api/disasters/report` - Submit report
- `GET /api/disasters/active` - Get active alerts
- `POST /api/disasters/{id}/verify` - Verify disaster

**Authorities:**
- `POST /api/authorities/login` - Authority login
- `POST /api/authorities/equipment` - Add equipment

## 🤝 Contributing

This is a production-ready foundation. To contribute:

1. Complete remaining frontend screens (see frontend/README.md)
2. Integrate real AI model
3. Add real SMS provider
4. Implement offline support
5. Add comprehensive tests

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Built for rural coastal communities in India to save lives through technology.

---

**Status:** ✅ Foundation Complete | 🚧 Additional Screens Needed | 🔄 Ready for AI Integration

For detailed setup and development instructions, see:
- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)
