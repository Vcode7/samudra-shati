from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from datetime import datetime

from ..database import get_db
from ..models import User, DisasterReport, VerificationResponse, TrustScore, DisasterStatus, DisasterAlertStatus, Device
from ..schemas import (
    DisasterReportCreate, DisasterReportResponse,
    VerificationCreate, VerificationResponse as VerificationResponseSchema,
    VerificationWithEmergencyResponse, EmergencyStatusResponse
)
from ..dependencies import get_current_user, get_current_authority
from ..services.image_service import ImageService
from ..services.notification_service import NotificationService
from ..services.alert_service import AlertService

router = APIRouter(prefix="/api/disasters", tags=["disasters"])

def find_nearby_active_disaster(lat: float, lng: float, db: Session):
    active = db.query(DisasterReport).filter(
        DisasterReport.status.in_([DisasterStatus.PENDING, DisasterStatus.VERIFIED])
    ).all()

    for d in active:
        distance = AlertService.calculate_distance(lat, lng, d.latitude, d.longitude)
        if distance <= d.danger_radius_km:
            return d, distance

    return None, None

@router.post("/report", response_model=DisasterReportResponse,)
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
    print("USER:", current_user)
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
    
    existing_disaster, distance = find_nearby_active_disaster(latitude, longitude, db)

    if existing_disaster:
        # Treat as verification
        existing_disaster.verification_count_yes += 1

        # Expand radius to include the new point
        new_radius = max(
            existing_disaster.danger_radius_km,
            distance + 0.5  # add buffer of 500m
        )

        existing_disaster.danger_radius_km = round(new_radius, 2)

        # Optional: slightly increase severity if many reports come in
        if existing_disaster.verification_count_yes >= 3:
            existing_disaster.severity_level = min(10, existing_disaster.severity_level + 2)

        # Auto-verify if many reports come in
        if (existing_disaster.verification_count_yes >= existing_disaster.emergency_confirmation_threshold and 
            existing_disaster.alert_status != DisasterAlertStatus.EMERGENCY_ACTIVE):
            
            existing_disaster.alert_status = DisasterAlertStatus.EMERGENCY_ACTIVE
            existing_disaster.status = DisasterStatus.VERIFIED
            
            # Send emergency alert to ALL devices in danger radius
            nearby_devices = db.query(Device).filter(
                Device.is_active == True,
                Device.expo_push_token.isnot(None)
            ).all()
            
            tokens = [d.expo_push_token for d in nearby_devices]
            
            if tokens:
                # Prepare emergency message
                messages = {
                    "en": {
                        "title": "🚨 EMERGENCY ALERT",
                        "body": f"VERIFIED DISASTER near {disaster.location_name}! Community confirmed ({disaster.verification_count_yes} people). If you are nearby, evacuate immediately!"
                    },
                    "hi": {
                        "title": "🚨 आपातकालीन अलर्ट",
                        "body": f"{disaster.location_name} के पास सत्यापित आपदा! समुदाय द्वारा पुष्टि ({disaster.verification_count_yes} लोग)। यदि आप पास में हैं, तुरंत निकासी करें!"
                    },
                    "ta": {
                        "title": "🚨 அவசர எச்சரிக்கை",
                        "body": f"{disaster.location_name} அருகில் சரிபார்க்கப்பட்ட பேரிடர்! சமூகம் உறுதிப்படுத்தியது. நீங்கள் அருகில் இருந்தால், உடனடியாக வெளியேறுங்கள்!"
                    }
                }
                
                await NotificationService.send_push_notification(
                    expo_tokens=tokens,
                    title=messages["en"]["title"],
                    body=messages["en"]["body"],
                    data={
                        "type": "emergency_active",
                        "disaster_id": disaster.id,
                        "latitude": disaster.latitude,
                        "longitude": disaster.longitude,
                        "danger_radius_km": disaster.danger_radius_km,
                        "severity": disaster.severity_level,
                        "location": disaster.location_name,
                        "messages": messages
                    },
                    priority="high"
                )
    

        db.commit()
        db.refresh(existing_disaster)

        return existing_disaster

    # Validate media file (image or video)
    allowed_types = ["image/", "video/"]
    if not any(image.content_type.startswith(t) for t in allowed_types):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image or video"
        )
    
    # Read image content
    image_content = await image.read()
    
    # Check file size
    max_size = 100 * 1024 * 1024  # 100MB
    if len(image_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file too large (max 100MB)"
        )
    
    # Save image
    image_filename = await ImageService.save_image(image_content, image.filename)
    image_url = ImageService.get_image_url(image_filename)
    
    # Analyze image using AI service
    ai_analysis = await ImageService.analyze_image_async(
        image_path=image_filename,
        file_content=image_content,
        content_type=image.content_type
    )
    
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
        radius_km=50.0,  # 10km radius
        db=db,
        exclude_user_id=current_user.id
    )
    print("NEARBY USERS:", [u.id for u in nearby_users])
    print("TOKENS:", [u.expo_push_token for u in nearby_users])
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
    db: Session = Depends(get_db)
):
    """
    Get active disaster reports (pending or verified)
    """
    disasters = db.query(DisasterReport).filter(
        DisasterReport.status.in_([DisasterStatus.PENDING, DisasterStatus.VERIFIED])
    ).order_by(DisasterReport.created_at.desc()).limit(50).all()
    
    results = []
    for d in disasters:
        dt = d.created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        created_at = dt.isoformat().replace("+00:00", "Z")
        results.append({
            **d.__dict__,
            "created_at": created_at,
            "distance_km": None,
        })
    
    return results


from datetime import timezone

@router.get("/recent", response_model=List[DisasterReportResponse])
async def get_recent_disasters(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    disasters = (
        db.query(DisasterReport)
        .order_by(DisasterReport.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for d in disasters:
        dt = d.created_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        created_at = dt.isoformat().replace("+00:00", "Z")
        results.append({
            **d.__dict__,
            "created_at": created_at,
            "distance_km": None,  # frontend fallback will handle
        })

    return results


@router.get("/{disaster_id}", response_model=DisasterReportResponse)
async def get_disaster_details(
    disaster_id: int,
    db: Session = Depends(get_db)
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
    
    dt = disaster.created_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    created_at = dt.isoformat().replace("+00:00", "Z")
    
    return {
        **disaster.__dict__,
        "created_at": created_at,
        "distance_km": None
    }


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
    
    # NEW: Check if disaster is still pending verification
    if disaster.status != DisasterStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot verify: disaster status is already {disaster.status.value}"
        )
    
    # NEW: Check if disaster report is less than 30 minutes old
    from datetime import datetime, timedelta
    
    # Ensure disaster.created_at is timezone-aware for comparison if needed
    # But usually datetime.utcnow() is naive, so we compare naive to naive
    dt = disaster.created_at
    if dt.tzinfo is not None:
        current_time = datetime.now(timezone.utc)
    else:
        current_time = datetime.utcnow()
        
    report_age = current_time - dt
    if report_age > timedelta(minutes=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot verify: disaster report is older than 30 minutes"
        )
    
    # NEW: Check if user is within 10km of disaster location
    if verification_data.latitude and verification_data.longitude:
        distance = AlertService.calculate_distance(
            verification_data.latitude, verification_data.longitude,
            disaster.latitude, disaster.longitude
        )
        if distance > 10.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot verify: you are {distance:.1f}km away (must be within 10km)"
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
    emergency_triggered = False
    
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
    
    # Check if emergency mode should be triggered (5+ confirmations)
    if (disaster.verification_count_yes >= disaster.emergency_confirmation_threshold and 
        disaster.alert_status != DisasterAlertStatus.EMERGENCY_ACTIVE):
        
        disaster.alert_status = DisasterAlertStatus.EMERGENCY_ACTIVE
        disaster.status = DisasterStatus.VERIFIED
        emergency_triggered = True
        
        # Send emergency alert to ALL devices in danger radius
        nearby_devices = db.query(Device).filter(
            Device.is_active == True,
            Device.expo_push_token.isnot(None)
        ).all()
        
        tokens = [d.expo_push_token for d in nearby_devices]
        
        if tokens:
            # Prepare emergency message
            messages = {
                "en": {
                    "title": "🚨 EMERGENCY ALERT",
                    "body": f"VERIFIED DISASTER near {disaster.location_name}! Community confirmed ({disaster.verification_count_yes} people). If you are nearby, evacuate immediately!"
                },
                "hi": {
                    "title": "🚨 आपातकालीन अलर्ट",
                    "body": f"{disaster.location_name} के पास सत्यापित आपदा! समुदाय द्वारा पुष्टि ({disaster.verification_count_yes} लोग)। यदि आप पास में हैं, तुरंत निकासी करें!"
                },
                "ta": {
                    "title": "🚨 அவசர எச்சரிக்கை",
                    "body": f"{disaster.location_name} அருகில் சரிபார்க்கப்பட்ட பேரிடர்! சமூகம் உறுதிப்படுத்தியது. நீங்கள் அருகில் இருந்தால், உடனடியாக வெளியேறுங்கள்!"
                }
            }
            
            await NotificationService.send_push_notification(
                expo_tokens=tokens,
                title=messages["en"]["title"],
                body=messages["en"]["body"],
                data={
                    "type": "emergency_active",
                    "disaster_id": disaster.id,
                    "latitude": disaster.latitude,
                    "longitude": disaster.longitude,
                    "danger_radius_km": disaster.danger_radius_km,
                    "severity": disaster.severity_level,
                    "location": disaster.location_name,
                    "messages": messages
                },
                priority="high"
            )
    
    db.commit()
    db.refresh(verification)
    
    # Return verification with emergency status
    # Fix timezone for created_at
    v_dt = verification.created_at
    if v_dt.tzinfo is None:
        v_dt = v_dt.replace(tzinfo=timezone.utc)
    
    # We return Pydantic model here, need to update the object or return dict
    # But schema expects datetime, so modifying the object in place works if schema config allows
    verification.created_at = v_dt
    
    return VerificationWithEmergencyResponse(
        id=verification.id,
        disaster_report_id=verification.disaster_report_id,
        user_id=verification.user_id,
        is_confirmed=verification.is_confirmed,
        created_at=verification.created_at,
        emergency_triggered=emergency_triggered,
        total_confirmations=disaster.verification_count_yes
    )


@router.get("/{disaster_id}/my-verification")
async def get_my_verification_status(
    disaster_id: int,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if current user has verified this disaster and if they can verify.
    
    Returns:
        - has_verified: whether user has already submitted a verification
        - is_confirmed: if verified, was it a confirmation or rejection
        - can_verify: whether user can still verify (status pending, <30min, nearby if coords provided)
        - reason: if cannot verify, explains why
    """
    from datetime import datetime, timedelta
    
    # Get disaster
    disaster = db.query(DisasterReport).filter(
        DisasterReport.id == disaster_id
    ).first()
    
    if not disaster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disaster report not found"
        )
    
    # Check if user already verified
    existing = db.query(VerificationResponse).filter(
        VerificationResponse.disaster_report_id == disaster_id,
        VerificationResponse.user_id == current_user.id
    ).first()
    
    has_verified = existing is not None
    is_confirmed = existing.is_confirmed if existing else None
    
    # Check if can verify
    can_verify = True
    reason = None
    
    # Fix timezone for comparison
    dt = disaster.created_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
        current_time_utc = datetime.now(timezone.utc)
    else:
        current_time_utc = datetime.now(timezone.utc)
        
    created_at_iso = dt.isoformat().replace("+00:00", "Z")
    
    if has_verified:
        can_verify = False
        reason = "You have already verified this disaster"
    elif disaster.status != DisasterStatus.PENDING:
        can_verify = False
        reason = f"Disaster status is {disaster.status.value}"
    else:
        # Check time
        report_age = current_time_utc - dt
        if report_age > timedelta(minutes=30):
            can_verify = False
            reason = "Disaster report is older than 30 minutes"
        elif lat is not None and lng is not None:
            # Check distance
            distance = AlertService.calculate_distance(lat, lng, disaster.latitude, disaster.longitude)
            if distance > 10.0:
                can_verify = False
                reason = f"You are {distance:.1f}km away (must be within 10km)"
    
    return {
        "has_verified": has_verified,
        "is_confirmed": is_confirmed,
        "can_verify": can_verify,
        "reason": reason,
        "disaster_status": disaster.status.value,
        "disaster_created_at": created_at_iso
    }


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
            # Fix timezone
            dt = disaster.created_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            created_at = dt.isoformat().replace("+00:00", "Z")
            
            # Create dict with fixed time
            disaster_dict = {
                **disaster.__dict__,
                "created_at": created_at,
                "distance_km": None 
            }
            nearby_disasters.append(disaster_dict)
            
            # Note: We can't sort dictionary by attribute easily if we mix types, 
            # but here we used `disaster_dict['created_at']` which is a string. 
            # Original sort used `x.created_at` (datetime).
    
    # Sort by creation time (newest first)
    # Using the ISO string for sorting works (descending)
    nearby_disasters.sort(key=lambda x: x['created_at'], reverse=True)
    
    return nearby_disasters[:20]  # Limit to 20 results


@router.post("/{disaster_id}/resolve")
async def resolve_disaster(
    disaster_id: int,
    _: object = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    disaster = db.query(DisasterReport).filter(DisasterReport.id == disaster_id).first()
    if not disaster:
        raise HTTPException(status_code=404, detail="Disaster report not found")

    disaster.status = DisasterStatus.RESOLVED
    disaster.alert_status = DisasterAlertStatus.RESOLVED
    disaster.resolved_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "disaster_id": disaster.id,
        "status": disaster.status.value,
        "alert_status": disaster.alert_status.value,
    }


@router.patch("/{disaster_id}/danger-radius")
async def update_danger_radius(
    disaster_id: int,
    danger_radius_km: float = Body(..., embed=True),
    _: object = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    if danger_radius_km <= 0:
        raise HTTPException(status_code=400, detail="danger_radius_km must be > 0")

    disaster = db.query(DisasterReport).filter(DisasterReport.id == disaster_id).first()
    if not disaster:
        raise HTTPException(status_code=404, detail="Disaster report not found")

    disaster.danger_radius_km = float(danger_radius_km)
    db.commit()

    return {
        "success": True,
        "disaster_id": disaster.id,
        "danger_radius_km": disaster.danger_radius_km,
    }


@router.post("/demo")
async def trigger_demo_emergency(
    latitude: float = 13.0827,  # Default Chennai
    longitude: float = 80.2707,
    db: Session = Depends(get_db)
):
    """
    ⚠️ DEMO MODE - For Testing Only
    
    Triggers a 30-second emergency simulation:
    - Creates temporary demo disaster
    - Sends push notifications to all devices
    - Enables emergency mode on connected apps
    - Auto-cleanup after 30 seconds
    """
    import asyncio
    from datetime import timedelta
    
    # Create a demo disaster report
    demo_disaster = DisasterReport(
        reporter_id=1,  # System user
        latitude=latitude,
        longitude=longitude,
        location_name="[DEMO] Emergency Simulation",
        description="⚠️ This is a DEMO emergency. Not a real disaster.",
        image_url="/uploads/demo_disaster.jpg",
        severity_level=8,
        status=DisasterStatus.VERIFIED,
        alert_status=DisasterAlertStatus.EMERGENCY_ACTIVE,
        danger_radius_km=2.0,
        is_demo=True  # Mark as demo
    )
    
    db.add(demo_disaster)
    db.commit()
    db.refresh(demo_disaster)
    
    # Get all devices with push tokens
    devices = db.query(Device).filter(
        Device.is_active == True,
        Device.expo_push_token.isnot(None)
    ).all()
    
    tokens = [d.expo_push_token for d in devices if d.expo_push_token]
    
    if tokens:
        # Send emergency notification
        emergency_messages = {
            "en": {
                "title": "🚨 [DEMO] EMERGENCY ALERT",
                "body": "⚠️ Demo Mode Active - This is a TEST. Emergency mode for 30 seconds."
            },
            "hi": {
                "title": "🚨 [डेमो] आपातकालीन अलर्ट",
                "body": "⚠️ डेमो मोड सक्रिय - यह एक परीक्षण है। 30 सेकंड के लिए आपातकालीन मोड।"
            },
            "ta": {
                "title": "🚨 [டெமோ] அவசர எச்சரிக்கை",
                "body": "⚠️ டெமோ முறை செயல்பாட்டில் - இது ஒரு சோதனை. 30 வினாடிகளுக்கு அவசரநிலை."
            }
        }
        
        await NotificationService.send_push_notification(
            expo_tokens=tokens,
            title=emergency_messages["en"]["title"],
            body=emergency_messages["en"]["body"],
            data={
                "type": "emergency_active",
                "disaster_id": demo_disaster.id,
                "latitude": latitude,
                "longitude": longitude,
                "danger_radius_km": 2.0,
                "location": "[DEMO] Emergency Simulation",
                "is_demo": True,
                "duration_seconds": 30,
                "messages": emergency_messages
            },
            priority="high"
        )
    
    # Schedule cleanup after 30 seconds (background task)
    async def cleanup_demo():
        await asyncio.sleep(30)
        from ..database import SessionLocal
        cleanup_db = SessionLocal()
        try:
            demo = cleanup_db.query(DisasterReport).filter(
                DisasterReport.id == demo_disaster.id
            ).first()
            if demo:
                demo.status = DisasterStatus.RESOLVED
                demo.alert_status = DisasterAlertStatus.RESOLVED
                cleanup_db.commit()
                print(f"[DEMO] Cleaned up demo disaster {demo_disaster.id}")
        finally:
            cleanup_db.close()
    
    # Run cleanup in background
    asyncio.create_task(cleanup_demo())
    
    return {
        "success": True,
        "demo_id": demo_disaster.id,
        "message": "⚠️ Demo emergency started for 30 seconds",
        "devices_notified": len(tokens),
        "cleanup_after_seconds": 30
    }


@router.delete("/demo/{demo_id}")
async def cancel_demo_emergency(
    demo_id: int,
    db: Session = Depends(get_db)
):
    """Cancel a running demo emergency"""
    demo = db.query(DisasterReport).filter(
        DisasterReport.id == demo_id
    ).first()
    
    if not demo:
        raise HTTPException(status_code=404, detail="Demo not found")
    
    demo.status = DisasterStatus.RESOLVED
    demo.alert_status = DisasterAlertStatus.RESOLVED
    db.commit()
    
    return {"success": True, "message": "Demo emergency cancelled"}


# ============ Analytics Endpoints ============

@router.get("/analytics/summary")
async def get_analytics_summary(
    db: Session = Depends(get_db)
):
    """
    Get summary statistics for disasters.
    Returns counts of total, verified, pending, false alarms, and resolved.
    """
    from sqlalchemy import func
    
    total = db.query(func.count(DisasterReport.id)).scalar() or 0
    verified = db.query(func.count(DisasterReport.id)).filter(
        DisasterReport.status == DisasterStatus.VERIFIED
    ).scalar() or 0
    pending = db.query(func.count(DisasterReport.id)).filter(
        DisasterReport.status == DisasterStatus.PENDING
    ).scalar() or 0
    false_alarms = db.query(func.count(DisasterReport.id)).filter(
        DisasterReport.status == DisasterStatus.FALSE_ALARM
    ).scalar() or 0
    resolved = db.query(func.count(DisasterReport.id)).filter(
        DisasterReport.status == DisasterStatus.RESOLVED
    ).scalar() or 0
    
    emergency_active = db.query(func.count(DisasterReport.id)).filter(
        DisasterReport.alert_status == DisasterAlertStatus.EMERGENCY_ACTIVE
    ).scalar() or 0
    
    return {
        "total": total,
        "verified": verified,
        "pending": pending,
        "false_alarms": false_alarms,
        "resolved": resolved,
        "emergency_active": emergency_active
    }


@router.get("/analytics/by-day")
async def get_disasters_by_day(
    days: int = 7,
    db: Session = Depends(get_db)
):
    """
    Get disaster counts grouped by day for the last N days.
    """
    from sqlalchemy import func, cast, Date
    from datetime import timedelta
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    results = db.query(
        cast(DisasterReport.created_at, Date).label("date"),
        func.count(DisasterReport.id).label("count"),
        func.sum(
            func.case(
                (DisasterReport.status == DisasterStatus.VERIFIED, 1),
                else_=0
            )
        ).label("verified"),
        func.sum(
            func.case(
                (DisasterReport.status == DisasterStatus.FALSE_ALARM, 1),
                else_=0
            )
        ).label("false_alarms")
    ).filter(
        DisasterReport.created_at >= cutoff
    ).group_by(
        cast(DisasterReport.created_at, Date)
    ).order_by(
        cast(DisasterReport.created_at, Date)
    ).all()
    
    return [
        {
            "date": str(r.date),
            "count": r.count,
            "verified": r.verified or 0,
            "false_alarms": r.false_alarms or 0
        }
        for r in results
    ]


@router.get("/analytics/response-time")
async def get_average_response_time(
    db: Session = Depends(get_db)
):
    """
    Get average response time metrics.
    Response time = time from report creation to verification/resolution.
    """
    from sqlalchemy import func
    
    # Get disasters that have been resolved with resolved_at timestamp
    resolved_disasters = db.query(DisasterReport).filter(
        DisasterReport.resolved_at.isnot(None)
    ).all()
    
    if not resolved_disasters:
        return {
            "average_response_minutes": None,
            "fastest_response_minutes": None,
            "slowest_response_minutes": None,
            "total_resolved": 0
        }
    
    response_times = []
    for d in resolved_disasters:
        if d.resolved_at and d.created_at:
            diff = d.resolved_at - d.created_at
            response_times.append(diff.total_seconds() / 60)  # in minutes
    
    if not response_times:
        return {
            "average_response_minutes": None,
            "fastest_response_minutes": None,
            "slowest_response_minutes": None,
            "total_resolved": 0
        }
    
    return {
        "average_response_minutes": round(sum(response_times) / len(response_times), 2),
        "fastest_response_minutes": round(min(response_times), 2),
        "slowest_response_minutes": round(max(response_times), 2),
        "total_resolved": len(response_times)
    }

