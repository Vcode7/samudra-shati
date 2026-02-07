# samudra saathi - Backend API

FastAPI backend for the disaster alert and reporting system.

## Features

- **User Authentication**: Phone number OTP verification (mock service)
- **Authority Management**: Secure login for emergency services
- **Disaster Reporting**: Image upload with mock AI analysis
- **Verification System**: Community-based disaster verification
- **Alert Distribution**: Push notifications to nearby users and authorities
- **Trust Scoring**: User credibility tracking
- **Equipment Management**: Authority resource tracking

## Tech Stack

- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: ORM for database operations
- **PostgreSQL/SQLite**: Database (configurable)
- **JWT**: Token-based authentication
- **Expo Push**: Notification service
- **Pillow**: Image processing

## Setup

### Prerequisites

- Python 3.9+
- PostgreSQL (optional, SQLite works for development)

### Installation

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
copy .env.example .env

# Edit .env with your configuration
```

### Database Setup

The database will be automatically created when you first run the application.

For PostgreSQL:
```bash
# Create database
createdb samudar_shati

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/samudar_shati
```

For SQLite (default):
```bash
# No setup needed, will create samudar_shati.db automatically
```

### Running the Server

```bash
# Development mode (with auto-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or use Python directly
python -m app.main
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## API Endpoints

### User Endpoints

- `POST /api/users/request-otp` - Request OTP for phone verification
- `POST /api/users/verify-otp` - Verify OTP and get JWT token
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile (language, push token)
- `GET /api/users/trust-score` - Get user trust score

### Authority Endpoints

- `POST /api/authorities/login` - Authority login
- `POST /api/authorities/register` - Register new authority
- `GET /api/authorities/me` - Get authority profile
- `PUT /api/authorities/me` - Update authority profile
- `POST /api/authorities/equipment` - Add equipment
- `GET /api/authorities/equipment` - List equipment
- `PUT /api/authorities/equipment/{id}` - Update equipment
- `DELETE /api/authorities/equipment/{id}` - Delete equipment

### Disaster Endpoints

- `POST /api/disasters/report` - Submit disaster report with image
- `GET /api/disasters/active` - Get active disasters
- `GET /api/disasters/recent` - Get recent disasters (paginated)
- `GET /api/disasters/{id}` - Get disaster details
- `POST /api/disasters/{id}/verify` - Verify disaster report
- `GET /api/disasters/nearby` - Get nearby disasters

## Mock Services

### OTP Service

Currently logs OTP to console. Integration points marked with `TODO` for real SMS provider (Twilio, MSG91, etc.).

```python
# In app/services/otp_service.py
# TODO: Replace with real SMS provider integration
```

### AI Image Analysis

Returns mock hazard detection results. Integration points marked for AI model.

```python
# In app/services/image_service.py
# TODO: Replace with actual AI model integration
```

## Database Schema

### Users
- Phone number authentication
- Language preferences (primary + secondary)
- Trust score tracking
- Expo push token

### Authorities
- Username/password authentication
- Authority type (Fire, Coast Guard, NDRF, Medical, Police)
- Operational radius
- Equipment inventory

### Disaster Reports
- Image + location + timestamp
- AI analysis results (mock)
- Verification counts
- Status tracking

### Verifications
- User responses (yes/no)
- Location tracking
- Trust score impact

## Development Notes

### Testing OTP Flow

In development mode, OTP codes are printed to console:

```
==================================================
📱 MOCK SMS SERVICE
==================================================
To: +919876543210
OTP: 123456
Expires: 2026-02-02 16:17:38 UTC
==================================================
```

### Testing Notifications

Ensure frontend has registered Expo push token. Check console for notification delivery status.

### Trust Score System

- Initial score: 100
- False alarm: -10 points
- Score < 20: User blocked from reporting

## Production Checklist

- [ ] Replace mock OTP service with real SMS provider
- [ ] Integrate actual AI image analysis model
- [ ] Set up PostgreSQL database
- [ ] Configure production SECRET_KEY
- [ ] Set up proper CORS origins
- [ ] Enable HTTPS
- [ ] Set up CDN for image uploads
- [ ] Implement proper geospatial queries (PostGIS)
- [ ] Add comprehensive logging
- [ ] Set up monitoring and alerts
- [ ] Implement rate limiting per user
- [ ] Add admin dashboard endpoints

## License

MIT
