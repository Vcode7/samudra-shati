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
