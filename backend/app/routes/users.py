from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from ..database import get_db
from ..models import User, TrustScore, DisasterReport, VerificationResponse
from ..schemas import (
    OTPRequest, OTPVerify, OTPResponse, Token,
    UserResponse, UserUpdate, TrustScoreResponse
)
from ..auth import create_access_token, validate_phone_number, normalize_phone_number
from ..dependencies import get_current_user
from ..services.otp_service import OTPService

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/request-otp", response_model=OTPResponse)
async def request_otp(
    request: OTPRequest,
    db: Session = Depends(get_db)
):
    """
    Request OTP for phone number verification
    """
    # Validate phone number
    if not validate_phone_number(request.phone_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number format"
        )
    
    # Normalize phone number
    phone_number = normalize_phone_number(request.phone_number)
    
    # Send OTP
    result = OTPService.send_otp(phone_number, db)
    
    return OTPResponse(**result)


@router.post("/verify-otp", response_model=Token)
async def verify_otp(
    request: OTPVerify,
    db: Session = Depends(get_db)
):
    """
    Verify OTP and return JWT token
    Creates user if doesn't exist
    """
    # Normalize phone number
    phone_number = normalize_phone_number(request.phone_number)
    
    # Verify OTP
    is_valid = OTPService.verify_otp(phone_number, request.otp_code, db)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
    
    # Find or create user
    user = db.query(User).filter(User.phone_number == phone_number).first()
    
    if not user:
        user = User(
            phone_number=phone_number,
            device_id=request.device_id,
            is_verified=True,
            expo_push_token=request.expo_push_token
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update existing user
        user.is_verified = True
        user.last_login = datetime.utcnow()
        
        if request.device_id:
            user.device_id = request.device_id
        
        if request.expo_push_token:
            user.expo_push_token = request.expo_push_token
        
        db.commit()
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "type": "user"}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_type="user"
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user profile
    """
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user profile (language preferences, push token)
    """
    if update_data.primary_language is not None:
        current_user.primary_language = update_data.primary_language.value
    
    if update_data.secondary_language is not None:
        current_user.secondary_language = update_data.secondary_language.value
    
    if update_data.expo_push_token is not None:
        current_user.expo_push_token = update_data.expo_push_token
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.get("/trust-score", response_model=TrustScoreResponse)
async def get_trust_score(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's trust score and statistics
    """
    # Count reports
    total_reports = db.query(DisasterReport).filter(
        DisasterReport.reporter_id == current_user.id
    ).count()
    
    # Count verifications
    total_verifications = db.query(VerificationResponse).filter(
        VerificationResponse.user_id == current_user.id
    ).count()
    
    # Count accurate verifications (simplified - would need more complex logic)
    accurate_verifications = db.query(VerificationResponse).join(
        DisasterReport
    ).filter(
        VerificationResponse.user_id == current_user.id,
        DisasterReport.status == "verified"
    ).count()
    
    return TrustScoreResponse(
        user_id=current_user.id,
        current_score=current_user.trust_score,
        total_reports=total_reports,
        total_verifications=total_verifications,
        accurate_verifications=accurate_verifications
    )
