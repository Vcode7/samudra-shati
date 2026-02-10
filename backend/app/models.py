from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base


class AuthorityType(str, enum.Enum):
    """Types of authority organizations"""
    FIRE = "fire"
    COAST_GUARD = "coast_guard"
    NDRF = "ndrf"
    MEDICAL = "medical"
    POLICE = "police"


class EquipmentType(str, enum.Enum):
    """Types of rescue equipment"""
    BOAT = "boat"
    AMBULANCE = "ambulance"
    HELICOPTER = "helicopter"
    RESCUE_KIT = "rescue_kit"


class DisasterStatus(str, enum.Enum):
    """Status of disaster reports"""
    PENDING = "pending"
    VERIFIED = "verified"
    FALSE_ALARM = "false_alarm"
    RESOLVED = "resolved"


class AlertType(str, enum.Enum):
    """Types of alerts"""
    DISASTER_WARNING = "disaster_warning"
    VERIFICATION_REQUEST = "verification_request"
    AUTHORITY_RESPONSE = "authority_response"
    EMERGENCY_ACTIVE = "emergency_active"  # New: Continuous emergency alert


class DisasterAlertStatus(str, enum.Enum):
    """Alert escalation status based on community verification"""
    INITIAL = "initial"                     # First alert sent
    COMMUNITY_VERIFIED = "community_verified"  # 5+ users confirmed
    EMERGENCY_ACTIVE = "emergency_active"   # Continuous alerts active
    RESOLVED = "resolved"                   # Emergency ended


class User(Base):
    """User model for normal users"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(15), unique=True, index=True, nullable=False)
    device_id = Column(String(255), index=True)
    
    # Language preferences
    primary_language = Column(String(10), default="en")  # en, hi, ta
    secondary_language = Column(String(10), nullable=True)
    
    # Verification and trust
    is_verified = Column(Boolean, default=False)
    trust_score = Column(Float, default=100.0)
    
    # Expo push token for notifications
    expo_push_token = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    disaster_reports = relationship("DisasterReport", back_populates="reporter")
    verification_responses = relationship("VerificationResponse", back_populates="user")
    trust_scores = relationship("TrustScore", back_populates="user")


class Authority(Base):
    """Authority user model (Fire, Coast Guard, etc.)"""
    __tablename__ = "authorities"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Authority details
    authority_type = Column(Enum(AuthorityType), nullable=False)
    organization_name = Column(String(255), nullable=False)
    contact_number = Column(String(15), nullable=False)
    
    # Location and operational area
    base_latitude = Column(Float, nullable=False)
    base_longitude = Column(Float, nullable=False)
    operational_radius_km = Column(Float, default=50.0)  # Default 50km radius
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Expo push token
    expo_push_token = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    equipment = relationship("Equipment", back_populates="authority", cascade="all, delete-orphan")


class Equipment(Base):
    """Equipment available with authorities"""
    __tablename__ = "equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    authority_id = Column(Integer, ForeignKey("authorities.id"), nullable=False)
    
    equipment_type = Column(Enum(EquipmentType), nullable=False)
    quantity = Column(Integer, default=1)
    is_available = Column(Boolean, default=True)
    
    # Optional details
    description = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    authority = relationship("Authority", back_populates="equipment")


class DisasterReport(Base):
    """Disaster report submitted by users"""
    __tablename__ = "disaster_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Location
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(255), nullable=True)
    
    # Report details
    image_url = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    # AI Analysis (mock for now)
    ai_analysis = Column(Text, nullable=True)  # JSON string with mock results
    severity_level = Column(Integer, default=5)  # 1-10 scale
    
    # Verification
    verification_count_yes = Column(Integer, default=0)
    verification_count_no = Column(Integer, default=0)
    status = Column(Enum(DisasterStatus), default=DisasterStatus.PENDING)
    
    # Emergency mode tracking
    alert_status = Column(Enum(DisasterAlertStatus), default=DisasterAlertStatus.INITIAL)
    danger_radius_km = Column(Float, default=1.0)  # 1km default danger zone
    emergency_confirmation_threshold = Column(Integer, default=5)  # Number of confirmations to trigger emergency
    is_demo = Column(Boolean, default=False)  # Flag for demo/test disasters
    
    # AI Prediction tracking
    ai_predicted = Column(Boolean, default=False)  # True if this was created from AI prediction
    prediction_type = Column(String(100), nullable=True)  # Type of AI prediction (COASTAL_STORM_RISK, etc.)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    reporter = relationship("User", back_populates="disaster_reports")
    verifications = relationship("VerificationResponse", back_populates="disaster_report", cascade="all, delete-orphan")
    location_logs = relationship("UserLocationLog", back_populates="disaster_report", cascade="all, delete-orphan")


class VerificationResponse(Base):
    """User responses to verification requests"""
    __tablename__ = "verification_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    disaster_report_id = Column(Integer, ForeignKey("disaster_reports.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Response
    is_confirmed = Column(Boolean, nullable=False)  # True = Yes, False = No
    
    # User location at time of response
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    disaster_report = relationship("DisasterReport", back_populates="verifications")
    user = relationship("User", back_populates="verification_responses")


class AlertLog(Base):
    """Log of all alerts sent"""
    __tablename__ = "alert_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    alert_type = Column(Enum(AlertType), nullable=False)
    
    # Alert content
    title_en = Column(String(255), nullable=False)
    message_en = Column(Text, nullable=False)
    title_hi = Column(String(255), nullable=True)
    message_hi = Column(Text, nullable=True)
    title_ta = Column(String(255), nullable=True)
    message_ta = Column(Text, nullable=True)
    
    # Related disaster report (if applicable)
    disaster_report_id = Column(Integer, ForeignKey("disaster_reports.id"), nullable=True)
    
    # Recipients count
    recipients_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)


class TrustScore(Base):
    """Trust score history for users"""
    __tablename__ = "trust_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Score change
    previous_score = Column(Float, nullable=False)
    new_score = Column(Float, nullable=False)
    change_reason = Column(String(255), nullable=False)
    
    # Related entities
    disaster_report_id = Column(Integer, ForeignKey("disaster_reports.id"), nullable=True)
    verification_response_id = Column(Integer, ForeignKey("verification_responses.id"), nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="trust_scores")


class OTPStore(Base):
    """Temporary storage for OTPs (mock service)"""
    __tablename__ = "otp_store"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(15), index=True, nullable=False)
    otp_code = Column(String(6), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)


class Device(Base):
    """Device registration for push notifications (independent of user login)"""
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(255), unique=True, index=True, nullable=False)
    expo_push_token = Column(String(255), nullable=False, index=True)
    app_install_id = Column(String(255), nullable=True)
    
    # Optional user association (linked after login)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Device info
    platform = Column(String(50), nullable=True)  # ios, android
    
    # Last known location (for emergency/offline tracking)
    last_latitude = Column(Float, nullable=True)
    last_longitude = Column(Float, nullable=True)
    last_seen_at = Column(DateTime, nullable=True)
    battery_level = Column(Float, nullable=True)  # 0-100
    network_status = Column(String(20), default="online")  # online, offline
    
    # Status
    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExternalDisasterSource(str, enum.Enum):
    """Source of external disaster report"""
    TWITTER = "twitter"
    YOUTUBE = "youtube"
    NEWS_RSS = "news_rss"
    TELEGRAM = "telegram"


class ExternalDisasterReport(Base):
    """Disaster reports from social media/external sources"""
    __tablename__ = "external_disaster_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Source info
    source = Column(Enum(ExternalDisasterSource), nullable=False)
    source_id = Column(String(255), nullable=True)  # Original post ID
    source_url = Column(String(500), nullable=True)
    
    # Content
    text_content = Column(Text, nullable=True)
    media_url = Column(String(500), nullable=True)
    
    # Location (extracted)
    location_text = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Analysis
    confidence_score = Column(Float, default=0.5)  # 0-1
    keywords_matched = Column(Text, nullable=True)  # JSON array
    
    # Status
    is_processed = Column(Boolean, default=False)
    is_valid = Column(Boolean, default=True)
    
    # Timestamps
    detected_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserLocationLog(Base):
    """User location updates during emergency mode"""
    __tablename__ = "user_location_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Device/User identification
    device_id = Column(String(255), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Related disaster
    disaster_report_id = Column(Integer, ForeignKey("disaster_reports.id"), nullable=False)
    
    # Location data
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)  # GPS accuracy in meters
    
    # Computed distance from disaster
    distance_km = Column(Float, nullable=True)
    in_danger_zone = Column(Boolean, default=False)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    disaster_report = relationship("DisasterReport", back_populates="location_logs")


class SafeArea(Base):
    """Authority-defined safe zones during disasters"""
    __tablename__ = "safe_areas"
    
    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_km = Column(Float, default=0.5)
    description = Column(String(255), nullable=True)
    created_by_authority_id = Column(Integer, ForeignKey("authorities.id"), nullable=False)
    disaster_id = Column(Integer, ForeignKey("disaster_reports.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    authority = relationship("Authority", backref="safe_areas")
    disaster = relationship("DisasterReport", backref="safe_areas")


class DeviceLocation(Base):
    """Anonymized device movement tracking for crowd analysis"""
    __tablename__ = "device_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    device_hash = Column(String(64), index=True, nullable=False)  # Hashed device ID for anonymity
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    heading = Column(Float, nullable=True)  # Movement direction in degrees (0-360)
    speed = Column(Float, nullable=True)  # Speed in m/s
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class EvacuationAlert(Base):
    """Track evacuation alerts to prevent spam (throttling)"""
    __tablename__ = "evacuation_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    area_latitude = Column(Float, nullable=False)
    area_longitude = Column(Float, nullable=False)
    direction_degrees = Column(Float, nullable=False)  # Recommended evacuation direction
    disaster_id = Column(Integer, ForeignKey("disaster_reports.id"), nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    disaster = relationship("DisasterReport", backref="evacuation_alerts")


class ServiceCenterType(str, enum.Enum):
    """Types of service centers"""
    SAFE_ZONE = "safe_zone"
    HOSPITAL = "hospital"
    POLICE = "police"
    FIRE = "fire"
    COAST_GUARD = "coast_guard"
    RELIEF_CENTER = "relief_center"
    REPORT_CENTER = "report_center"


class ServiceCenter(Base):
    """Service centers (hospitals, police, fire, coast guard, relief) managed by authorities"""
    __tablename__ = "service_centers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    center_type = Column(Enum(ServiceCenterType), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_km = Column(Float, default=0.5)
    contact_number = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    created_by_authority_id = Column(Integer, ForeignKey("authorities.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    authority = relationship("Authority", backref="service_centers")


class PredictionStatus(str, enum.Enum):
    """Status of AI predictions"""
    PENDING = "pending"                  # Prediction sent, awaiting verification
    VERIFIED = "verified"                # Authority verified as real disaster
    CANCELLED = "cancelled"              # Authority determined false prediction
    EXPIRED = "expired"                  # Prediction validity period ended


class EarlyWarningPrediction(Base):
    """AI-generated early warning predictions from disaster-prediction-service"""
    __tablename__ = "early_warning_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Prediction details
    type = Column(String(100), nullable=False)  # COASTAL_STORM_RISK, FLOOD_RISK, etc.
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    severity = Column(Integer, nullable=False)  # 1-10 scale
    confidence = Column(Float, nullable=False)  # 0-1 confidence score
    
    # Source and message
    source_apis = Column(Text, nullable=False)  # JSON array: ["open-meteo", "openweather"]
    message = Column(Text, nullable=False)  # Human-readable warning message
    
    # Time validity
    predicted_at = Column(DateTime, nullable=False)  # When prediction was made
    valid_for_minutes = Column(Integer, default=360)  # How long prediction is valid
    
    # Status tracking
    status = Column(Enum(PredictionStatus), default=PredictionStatus.PENDING)
    verified_by_authority_id = Column(Integer, ForeignKey("authorities.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    verified_by_authority = relationship("Authority", backref="verified_predictions")


class EmergencyCallLog(Base):
    """Log of emergency calls made from mobile app to authorities"""
    __tablename__ = "emergency_call_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User/Device info
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    device_id = Column(String(255), nullable=False)
    
    # Authority called
    authority_id = Column(Integer, ForeignKey("authorities.id"), nullable=False)
    
    # Location at time of call
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Call metadata
    call_initiated_at = Column(DateTime, default=datetime.utcnow)
    location_sharing_stopped_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", backref="emergency_calls")
    authority = relationship("Authority", backref="emergency_calls")


class AlertStatus(str, enum.Enum):
    """Status of region disconnect alerts"""
    INVESTIGATING = "investigating"
    FALSE_ALARM = "false_alarm"
    CONFIRMED_INCIDENT = "confirmed_incident"
    PENDING = "pending"


class RegionDisconnectAlert(Base):
    """Alerts for when many devices go offline in same region"""
    __tablename__ = "region_disconnect_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Region center (approximate)
    center_latitude = Column(Float, nullable=False)
    center_longitude = Column(Float, nullable=False)
    radius_km = Column(Float, default=2.0)  # Radius of affected region
    
    # Alert details
    affected_device_count = Column(Integer, nullable=False)
    device_ids = Column(Text, nullable=False)  # JSON array of device IDs
    
    # Status
    status = Column(Enum(AlertStatus), default=AlertStatus.PENDING)
    
    # Authority handling
    assigned_authority_id = Column(Integer, ForeignKey("authorities.id"), nullable=True)
    
    # Timestamps
    detected_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assigned_authority = relationship("Authority", backref="disconnect_alerts")


