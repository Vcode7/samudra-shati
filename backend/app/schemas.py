from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# Enums
class LanguageCode(str, Enum):
    EN = "en"
    HI = "hi"
    TA = "ta"


class AuthorityTypeEnum(str, Enum):
    FIRE = "fire"
    COAST_GUARD = "coast_guard"
    NDRF = "ndrf"
    MEDICAL = "medical"
    POLICE = "police"


class EquipmentTypeEnum(str, Enum):
    BOAT = "boat"
    AMBULANCE = "ambulance"
    HELICOPTER = "helicopter"
    RESCUE_KIT = "rescue_kit"


class DisasterStatusEnum(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    FALSE_ALARM = "false_alarm"
    RESOLVED = "resolved"


# User Schemas
class UserCreate(BaseModel):
    phone_number: str
    device_id: Optional[str] = None
    primary_language: LanguageCode = LanguageCode.EN
    secondary_language: Optional[LanguageCode] = None


class UserUpdate(BaseModel):
    primary_language: Optional[LanguageCode] = None
    secondary_language: Optional[LanguageCode] = None
    expo_push_token: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    phone_number: str
    primary_language: str
    secondary_language: Optional[str]
    is_verified: bool
    trust_score: float
    created_at: datetime
    
    class Config:
        from_attributes = True


# OTP Schemas
class OTPRequest(BaseModel):
    phone_number: str


class OTPVerify(BaseModel):
    phone_number: str
    otp_code: str
    device_id: Optional[str] = None
    expo_push_token: Optional[str] = None


class OTPResponse(BaseModel):
    success: bool
    message: str
    expires_in_minutes: Optional[int] = None


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_type: str  # "user" or "authority"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    user_type: Optional[str] = None


# Authority Schemas
class AuthorityLogin(BaseModel):
    username: str
    password: str


class AuthorityCreate(BaseModel):
    username: str
    password: str
    authority_type: AuthorityTypeEnum
    organization_name: str
    contact_number: str
    base_latitude: float
    base_longitude: float
    operational_radius_km: float = 50.0


class AuthorityUpdate(BaseModel):
    operational_radius_km: Optional[float] = None
    expo_push_token: Optional[str] = None
    is_active: Optional[bool] = None


class AuthorityResponse(BaseModel):
    id: int
    username: str
    authority_type: str
    organization_name: str
    contact_number: str
    base_latitude: float
    base_longitude: float
    operational_radius_km: float
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Equipment Schemas
class EquipmentCreate(BaseModel):
    equipment_type: EquipmentTypeEnum
    quantity: int = 1
    description: Optional[str] = None


class EquipmentUpdate(BaseModel):
    quantity: Optional[int] = None
    is_available: Optional[bool] = None
    description: Optional[str] = None


class EquipmentResponse(BaseModel):
    id: int
    equipment_type: str
    quantity: int
    is_available: bool
    description: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Disaster Report Schemas
class DisasterReportCreate(BaseModel):
    latitude: float
    longitude: float
    location_name: Optional[str] = None
    description: Optional[str] = None


class DisasterReportResponse(BaseModel):
    id: int
    reporter_id: int
    latitude: float
    longitude: float
    location_name: Optional[str]
    image_url: str
    description: Optional[str]
    ai_analysis: Optional[str]
    severity_level: int
    verification_count_yes: int
    verification_count_no: int
    status: str
    alert_status: Optional[str] = "initial"
    danger_radius_km: float = 1.0
    created_at: datetime
    
    class Config:
        from_attributes = True


# Verification Schemas
class VerificationCreate(BaseModel):
    disaster_report_id: int
    is_confirmed: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class VerificationResponse(BaseModel):
    id: int
    disaster_report_id: int
    user_id: int
    is_confirmed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Alert Schemas
class AlertTest(BaseModel):
    """Schema for testing alerts"""
    message: Optional[str] = "This is a test alert"


# Trust Score Schema
class TrustScoreResponse(BaseModel):
    user_id: int
    current_score: float
    total_reports: int
    total_verifications: int
    accurate_verifications: int
    
    class Config:
        from_attributes = True


# Location Schema
class LocationData(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None


# Device Schemas
class DeviceRegister(BaseModel):
    """Schema for device registration (no auth required)"""
    device_id: str
    expo_push_token: str
    platform: Optional[str] = None
    app_install_id: Optional[str] = None


class DeviceLinkUser(BaseModel):
    """Schema for linking device to user after login"""
    device_id: str


class DeviceResponse(BaseModel):
    id: int
    device_id: str
    expo_push_token: str
    platform: Optional[str]
    user_id: Optional[int]
    is_active: bool
    last_seen: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class DeviceStatsResponse(BaseModel):
    """Statistics about registered devices"""
    total_devices: int
    active_devices: int
    devices_with_users: int
    android_devices: int
    ios_devices: int


# External Alert Schemas (from social crawler)
class ExternalSourceEnum(str, Enum):
    TWITTER = "twitter"
    YOUTUBE = "youtube"
    NEWS_RSS = "news_rss"
    TELEGRAM = "telegram"


class ExternalAlertCreate(BaseModel):
    """Schema for submitting external alerts from social crawler"""
    source: ExternalSourceEnum
    source_id: Optional[str] = None
    source_url: Optional[str] = None
    text_content: Optional[str] = None
    media_url: Optional[str] = None
    location_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    confidence_score: float = 0.5
    keywords_matched: Optional[List[str]] = None


class ExternalAlertResponse(BaseModel):
    id: int
    source: str
    text_content: Optional[str]
    location_text: Optional[str]
    confidence_score: float
    is_valid: bool
    detected_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


# Test Broadcast Schema
class TestBroadcastResponse(BaseModel):
    """Response from test broadcast"""
    success: bool
    total_tokens: int
    delivered_count: int
    failed_count: int
    message: Optional[str] = None


# Location Update Schemas (for emergency mode)
class LocationUpdate(BaseModel):
    """Schema for user location updates during emergency"""
    device_id: str
    latitude: float
    longitude: float
    disaster_id: int
    accuracy: Optional[float] = None


class RadiusCheckResponse(BaseModel):
    """Response for radius check - determines if user should vibrate"""
    in_danger_zone: bool
    distance_km: float
    should_vibrate: bool
    disaster_id: int
    disaster_latitude: float
    disaster_longitude: float
    danger_radius_km: float


class EmergencyStatusResponse(BaseModel):
    """Response with emergency mode status"""
    disaster_id: int
    alert_status: str
    confirmation_count: int
    threshold: int
    is_emergency_active: bool
    danger_radius_km: float


class VerificationWithEmergencyResponse(BaseModel):
    """Verification response that includes emergency mode status"""
    id: int
    disaster_report_id: int
    user_id: int
    is_confirmed: bool
    created_at: datetime
    emergency_triggered: bool = False
    total_confirmations: int = 0
    
    class Config:
        from_attributes = True


# Safe Area Schemas
class SafeAreaCreate(BaseModel):
    """Schema for creating a safe area"""
    latitude: float
    longitude: float
    radius_km: float = 0.5
    description: Optional[str] = None
    disaster_id: Optional[int] = None


class SafeAreaUpdate(BaseModel):
    """Schema for updating a safe area"""
    radius_km: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SafeAreaResponse(BaseModel):
    """Response schema for safe area"""
    id: int
    latitude: float
    longitude: float
    radius_km: float
    description: Optional[str]
    is_active: bool
    created_by_authority_id: int
    disaster_id: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Device Location Schemas
class DeviceLocationUpdate(BaseModel):
    """Schema for anonymous device location updates"""
    device_id: str
    latitude: float
    longitude: float
    heading: Optional[float] = None  # Direction in degrees
    speed: Optional[float] = None  # Speed in m/s


# Evacuation Direction Response
class EvacuationDirectionResponse(BaseModel):
    """Response with evacuation guidance"""
    has_safe_area: bool
    safe_area: Optional[SafeAreaResponse] = None
    distance_km: Optional[float] = None
    estimated_time_minutes: Optional[float] = None
    crowd_direction: Optional[float] = None  # Degrees (0-360)
    crowd_confidence: Optional[float] = None  # 0-1 confidence score
    bearing_to_safe_area: Optional[float] = None  # Degrees to safe area

