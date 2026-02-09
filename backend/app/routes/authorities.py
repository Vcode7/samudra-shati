from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from ..database import get_db
from ..models import Authority, Equipment, DisasterReport, Device, DisasterStatus, DisasterAlertStatus, UserLocationLog
from ..schemas import (
    AuthorityLogin, AuthorityCreate, AuthorityResponse,
    AuthorityUpdate, Token,
    EquipmentCreate, EquipmentUpdate, EquipmentResponse
)
from ..auth import verify_password, get_password_hash, create_access_token
from ..dependencies import get_current_authority
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/api/authorities", tags=["authorities"])



from fastapi import Request, Header, HTTPException

def require_web(request: Request, x_client: str = Header(None)):
    if request.method == "OPTIONS":
        return  # Allow CORS preflight

    if x_client != "web":
        raise HTTPException(status_code=403, detail="Web only endpoint")



@router.get("/nearby")
async def get_nearby_authorities(
    db: Session = Depends(get_db)
):
    """
    Get all active authorities for map display.
    Returns authorities with their base locations.
    """
    authorities = db.query(Authority).filter(
        Authority.is_active == True
    ).all()
    
    return [
        {
            "id": auth.id,
            "organization_name": auth.organization_name,
            "authority_type": auth.authority_type.value if hasattr(auth.authority_type, 'value') else str(auth.authority_type),
            "base_latitude": auth.base_latitude,
            "base_longitude": auth.base_longitude,
            "operational_radius_km": auth.operational_radius_km,
            "contact_number": auth.contact_number,
        }
        for auth in authorities
    ]


@router.post("/login", response_model=Token)
async def authority_login(
    credentials: AuthorityLogin,
    db: Session = Depends(get_db)
):
    """
    Authority login with username and password
    """
    # Find authority
    authority = db.query(Authority).filter(
        Authority.username == credentials.username
    ).first()
    
    if not authority or not verify_password(credentials.password, authority.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not authority.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authority account is inactive"
        )
    
    # Update last login
    authority.last_login = datetime.utcnow()
    db.commit()
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(authority.id), "type": "authority"}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_type="authority"
    )


@router.post("/register", response_model=AuthorityResponse)
async def register_authority(
    authority_data: AuthorityCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_web)  # Web-only registration
):
    """
    Register new authority
    
    Note: In production, this should be admin-only or require approval
    """
    # Check if username exists
    existing = db.query(Authority).filter(
        Authority.username == authority_data.username
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Create authority
    authority = Authority(
        username=authority_data.username,
        password_hash=get_password_hash(authority_data.password),
        authority_type=authority_data.authority_type,
        organization_name=authority_data.organization_name,
        contact_number=authority_data.contact_number,
        base_latitude=authority_data.base_latitude,
        base_longitude=authority_data.base_longitude,
        operational_radius_km=authority_data.operational_radius_km
    )
    
    db.add(authority)
    db.commit()
    db.refresh(authority)
    
    return authority


@router.get("/me", response_model=AuthorityResponse)
async def get_authority_profile(
    current_authority: Authority = Depends(get_current_authority)
):
    """
    Get current authority profile
    """
    return current_authority


@router.post("/{disaster_id}/verify")
async def verify_disaster_as_authority(
    disaster_id: int,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Authority-only instant verification.

    Behavior:
    - Immediately mark disaster as VERIFIED
    - Immediately set alert_status = EMERGENCY_ACTIVE
    - Trigger emergency push notifications

    Note: Device targeting is best-effort.
    If we have recent UserLocationLog entries for this disaster, we notify devices marked in_danger_zone.
    Otherwise we fall back to notifying all active devices (existing system behavior).
    """
    disaster = db.query(DisasterReport).filter(DisasterReport.id == disaster_id).first()
    if not disaster:
        raise HTTPException(status_code=404, detail="Disaster report not found")

    disaster.status = DisasterStatus.VERIFIED
    disaster.alert_status = DisasterAlertStatus.EMERGENCY_ACTIVE
    db.commit()
    db.refresh(disaster)

    # Try to notify devices that are in danger zone for this disaster (requires location logs)
    tokens: List[str] = []

    try:
        from sqlalchemy import func

        subquery = db.query(
            UserLocationLog.device_id,
            func.max(UserLocationLog.created_at).label("max_time")
        ).filter(
            UserLocationLog.disaster_report_id == disaster.id
        ).group_by(UserLocationLog.device_id).subquery()

        latest_logs = db.query(UserLocationLog).join(
            subquery,
            (UserLocationLog.device_id == subquery.c.device_id) &
            (UserLocationLog.created_at == subquery.c.max_time)
        ).filter(
            UserLocationLog.in_danger_zone == True
        ).all()

        device_ids = [l.device_id for l in latest_logs]
        if device_ids:
            devices = db.query(Device).filter(
                Device.device_id.in_(device_ids),
                Device.is_active == True,
                Device.expo_push_token.isnot(None)
            ).all()
            tokens = [d.expo_push_token for d in devices if d.expo_push_token]
    except Exception:
        tokens = []

    # Fallback: notify all active devices
    if not tokens:
        devices = db.query(Device).filter(
            Device.is_active == True,
            Device.expo_push_token.isnot(None)
        ).all()
        tokens = [d.expo_push_token for d in devices if d.expo_push_token]

    if tokens:
        messages = {
            "en": {
                "title": "🚨 EMERGENCY ALERT",
                "body": f"VERIFIED DISASTER near {disaster.location_name}! Authorities confirmed. Evacuate immediately if you are nearby."
            },
            "hi": {
                "title": "🚨 आपातकालीन अलर्ट",
                "body": f"{disaster.location_name} के पास सत्यापित आपदा! अधिकारियों द्वारा पुष्टि। यदि आप पास में हैं, तुरंत निकासी करें!"
            },
            "ta": {
                "title": "🚨 அவசர எச்சரிக்கை",
                "body": f"{disaster.location_name} அருகில் சரிபார்க்கப்பட்ட பேரிடர்! அதிகாரிகள் உறுதிப்படுத்தினர். நீங்கள் அருகில் இருந்தால் உடனடியாக வெளியேறுங்கள்!"
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
                "messages": messages,
                "verified_by": {
                    "authority_id": current_authority.id,
                    "organization_name": current_authority.organization_name,
                    "authority_type": str(current_authority.authority_type),
                }
            },
            priority="high"
        )

    return {
        "success": True,
        "disaster_id": disaster.id,
        "status": disaster.status.value,
        "alert_status": disaster.alert_status.value,
        "devices_notified": len(tokens)
    }


@router.put("/me", response_model=AuthorityResponse)
async def update_authority_profile(
    update_data: AuthorityUpdate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Update authority profile
    """
    if update_data.operational_radius_km is not None:
        current_authority.operational_radius_km = update_data.operational_radius_km
    
    if update_data.expo_push_token is not None:
        current_authority.expo_push_token = update_data.expo_push_token
    
    if update_data.is_active is not None:
        current_authority.is_active = update_data.is_active
    
    db.commit()
    db.refresh(current_authority)
    
    return current_authority


@router.post("/equipment", response_model=EquipmentResponse)
async def add_equipment(
    equipment_data: EquipmentCreate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Add equipment to authority inventory
    """
    equipment = Equipment(
        authority_id=current_authority.id,
        equipment_type=equipment_data.equipment_type,
        quantity=equipment_data.quantity,
        description=equipment_data.description
    )
    
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    
    return equipment


@router.get("/equipment", response_model=List[EquipmentResponse])
async def list_equipment(
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    List all equipment for current authority
    """
    equipment = db.query(Equipment).filter(
        Equipment.authority_id == current_authority.id
    ).all()
    
    return equipment


@router.put("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: int,
    update_data: EquipmentUpdate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Update equipment details
    """
    equipment = db.query(Equipment).filter(
        Equipment.id == equipment_id,
        Equipment.authority_id == current_authority.id
    ).first()
    
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    if update_data.quantity is not None:
        equipment.quantity = update_data.quantity
    
    if update_data.is_available is not None:
        equipment.is_available = update_data.is_available
    
    if update_data.description is not None:
        equipment.description = update_data.description
    
    equipment.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(equipment)
    
    return equipment


@router.delete("/equipment/{equipment_id}")
async def delete_equipment(
    equipment_id: int,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Delete equipment
    """
    equipment = db.query(Equipment).filter(
        Equipment.id == equipment_id,
        Equipment.authority_id == current_authority.id
    ).first()
    
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    db.delete(equipment)
    db.commit()
    
    return {"success": True, "message": "Equipment deleted"}
