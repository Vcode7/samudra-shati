from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from datetime import datetime

from ..database import get_db
from ..models import User, DisasterReport, VerificationResponse, TrustScore, DisasterStatus
from ..schemas import (
    DisasterReportCreate, DisasterReportResponse,
    VerificationCreate, VerificationResponse as VerificationResponseSchema
)
from ..dependencies import get_current_user
from ..services.image_service import ImageService
from ..services.notification_service import NotificationService
from ..services.alert_service import AlertService

router = APIRouter(prefix="/api/disasters", tags=["disasters"])


@router.post("/report", response_model=DisasterReportResponse)
async def create_disaster_report(
    latitude: float = Form(...),
    longitude: float = Form(...),
    location_name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit a disaster report with image
    
    Requires verified user
    """
    # Check if user is verified
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Phone number must be verified to submit reports"
        )
    
    # Check trust score (block if too low)
    if current_user.trust_score < 20:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your trust score is too low to submit reports. Please contact support."
        )
    
    # Validate image
    if not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Read image content
    image_content = await image.read()
    
    # Check file size
    max_size = 10 * 1024 * 1024  # 10MB
    if len(image_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file too large (max 10MB)"
        )
    
    # Save image
    image_filename = await ImageService.save_image(image_content, image.filename)
    image_url = ImageService.get_image_url(image_filename)
    
    # Analyze image (MOCK)
    ai_analysis = ImageService.analyze_image(image_filename)
    
    # Create disaster report
    disaster_report = DisasterReport(
        reporter_id=current_user.id,
        latitude=latitude,
        longitude=longitude,
        location_name=location_name or f"Location ({latitude:.4f}, {longitude:.4f})",
        image_url=image_url,
        description=description,
        ai_analysis=json.dumps(ai_analysis),
        severity_level=ai_analysis.get("severity", 5),
        status=DisasterStatus.PENDING
    )
    
    db.add(disaster_report)
    db.commit()
    db.refresh(disaster_report)
    
    # Send alerts to nearby users
    nearby_users = AlertService.get_nearby_users(
        latitude=latitude,
        longitude=longitude,
        radius_km=10.0,  # 10km radius
        db=db,
        exclude_user_id=current_user.id
    )
    
    if nearby_users:
        # Prepare multi-language messages
        messages = AlertService.prepare_multilingual_message(
            template_key="verification_request",
            location=location_name or "your area",
            severity=disaster_report.severity_level
        )
        
        # Get push tokens
        expo_tokens = [user.expo_push_token for user in nearby_users if user.expo_push_token]
        
        # Send verification request notifications
        if expo_tokens:
            await NotificationService.send_verification_request(
                expo_tokens=expo_tokens,
                disaster_id=disaster_report.id,
                location_name=disaster_report.location_name,
                messages=messages,
                db=db
            )
    
    # Alert relevant authorities
    authorities = AlertService.get_relevant_authorities(
        latitude=latitude,
        longitude=longitude,
        db=db
    )
    
    if authorities:
        messages = AlertService.prepare_multilingual_message(
            template_key="disaster_alert",
            location=location_name or "coastal area",
            severity=disaster_report.severity_level
        )
        
        authority_tokens = [auth.expo_push_token for auth in authorities if auth.expo_push_token]
        
        if authority_tokens:
            await NotificationService.send_disaster_alert(
                expo_tokens=authority_tokens,
                disaster_id=disaster_report.id,
                location_name=disaster_report.location_name,
                severity=disaster_report.severity_level,
                messages=messages,
                db=db
            )
    
    return disaster_report


@router.get("/active", response_model=List[DisasterReportResponse])
async def get_active_disasters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get active disaster reports (pending or verified)
    """
    disasters = db.query(DisasterReport).filter(
        DisasterReport.status.in_([DisasterStatus.PENDING, DisasterStatus.VERIFIED])
    ).order_by(DisasterReport.created_at.desc()).limit(50).all()
    
    return disasters


@router.get("/recent", response_model=List[DisasterReportResponse])
async def get_recent_disasters(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent disaster reports with pagination
    """
    disasters = db.query(DisasterReport).order_by(
        DisasterReport.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return disasters


@router.get("/{disaster_id}", response_model=DisasterReportResponse)
async def get_disaster_details(
    disaster_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get specific disaster report details
    """
    disaster = db.query(DisasterReport).filter(
        DisasterReport.id == disaster_id
    ).first()
    
    if not disaster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disaster report not found"
        )
    
    return disaster


@router.post("/{disaster_id}/verify", response_model=VerificationResponseSchema)
async def verify_disaster(
    disaster_id: int,
    verification_data: VerificationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit verification response for a disaster report
    """
    # Check if disaster exists
    disaster = db.query(DisasterReport).filter(
        DisasterReport.id == disaster_id
    ).first()
    
    if not disaster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disaster report not found"
        )
    
    # Check if user already verified this disaster
    existing = db.query(VerificationResponse).filter(
        VerificationResponse.disaster_report_id == disaster_id,
        VerificationResponse.user_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already verified this disaster"
        )
    
    # Create verification response
    verification = VerificationResponse(
        disaster_report_id=disaster_id,
        user_id=current_user.id,
        is_confirmed=verification_data.is_confirmed,
        latitude=verification_data.latitude,
        longitude=verification_data.longitude
    )
    
    db.add(verification)
    
    # Update disaster verification counts
    if verification_data.is_confirmed:
        disaster.verification_count_yes += 1
    else:
        disaster.verification_count_no += 1
    
    # Update disaster status based on verifications
    total_verifications = disaster.verification_count_yes + disaster.verification_count_no
    
    if total_verifications >= 3:
        if disaster.verification_count_yes >= 2:
            disaster.status = DisasterStatus.VERIFIED
        elif disaster.verification_count_no >= 2:
            disaster.status = DisasterStatus.FALSE_ALARM
            
            # Reduce reporter's trust score for false alarm
            reporter = db.query(User).filter(User.id == disaster.reporter_id).first()
            if reporter:
                old_score = reporter.trust_score
                reporter.trust_score = max(0, reporter.trust_score - 10)
                
                # Log trust score change
                trust_log = TrustScore(
                    user_id=reporter.id,
                    previous_score=old_score,
                    new_score=reporter.trust_score,
                    change_reason="False alarm report",
                    disaster_report_id=disaster.id
                )
                db.add(trust_log)
    
    db.commit()
    db.refresh(verification)
    
    return verification


@router.get("/nearby", response_model=List[DisasterReportResponse])
async def get_nearby_disasters(
    latitude: float,
    longitude: float,
    radius_km: float = 50.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get disasters near a location
    
    Note: This is a simplified implementation
    In production, use PostGIS for efficient geospatial queries
    """
    # Get all active disasters
    disasters = db.query(DisasterReport).filter(
        DisasterReport.status.in_([DisasterStatus.PENDING, DisasterStatus.VERIFIED])
    ).all()
    
    # Filter by distance
    nearby_disasters = []
    for disaster in disasters:
        distance = AlertService.calculate_distance(
            latitude, longitude,
            disaster.latitude, disaster.longitude
        )
        
        if distance <= radius_km:
            nearby_disasters.append(disaster)
    
    # Sort by creation time (newest first)
    nearby_disasters.sort(key=lambda x: x.created_at, reverse=True)
    
    return nearby_disasters[:20]  # Limit to 20 results
