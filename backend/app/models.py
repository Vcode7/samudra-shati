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
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    
    # Relationships
    reporter = relationship("User", back_populates="disaster_reports")
    verifications = relationship("VerificationResponse", back_populates="disaster_report", cascade="all, delete-orphan")


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
