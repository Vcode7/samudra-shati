"""
Notifications routes for authority dashboard
Send emergency broadcasts, area warnings, evacuation alerts
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum
from datetime import datetime

from ..database import get_db
from ..models import Authority, Device
from ..dependencies import get_current_authority
from ..services.notification_service import NotificationService
from ..services.alert_service import AlertService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationType(str, Enum):
    EMERGENCY_BROADCAST = "emergency_broadcast"
    AREA_WARNING = "area_warning"
    EVACUATION_ALERT = "evacuation_alert"
    INFO = "info"


class NotificationTarget(str, Enum):
    ALL = "all"
    AREA = "area"
    DEVICES = "devices"


class SendNotificationRequest(BaseModel):
    notification_type: NotificationType
    title: str
    body: str
    target: NotificationTarget = NotificationTarget.ALL
    # For area targeting
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = None
    # For specific devices
    device_ids: Optional[List[str]] = None
    # Optional disaster link
    disaster_id: Optional[int] = None


class NotificationResponse(BaseModel):
    success: bool
    devices_notified: int
    message: str


@router.post("/send", response_model=NotificationResponse)
async def send_notification(
    request: SendNotificationRequest,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Send notification to users.
    
    Supports:
    - ALL: Send to all active devices
    - AREA: Send to devices within radius of location
    - DEVICES: Send to specific device IDs
    """
    tokens: List[str] = []
    
    if request.target == NotificationTarget.ALL:
        devices = db.query(Device).filter(
            Device.is_active == True,
            Device.expo_push_token.isnot(None)
        ).all()
        tokens = [d.expo_push_token for d in devices if d.expo_push_token]
        
    elif request.target == NotificationTarget.AREA:
        if not all([request.latitude, request.longitude, request.radius_km]):
            raise HTTPException(
                status_code=400,
                detail="latitude, longitude, and radius_km required for area targeting"
            )
        
        # Import UserLocationLog for location data
        from ..models import UserLocationLog
        
        # Get recent device locations from UserLocationLog
        from datetime import timedelta
        recent_cutoff = datetime.utcnow() - timedelta(hours=24)

        print("\n\n\n\nrecent_cutoff",recent_cutoff)
        
        recent_locations = db.query(UserLocationLog).filter(
            UserLocationLog.created_at >= recent_cutoff
        ).distinct(UserLocationLog.device_id).all()
        print("recent_locations",recent_locations[0].device_id,recent_locations[0].latitude,recent_locations[0].longitude,recent_locations[0].created_at)
        # Build set of device IDs in the target area
        device_ids_in_area = set()
        for loc in recent_locations:
            distance = AlertService.calculate_distance(
                request.latitude, request.longitude,
                loc.latitude, loc.longitude
            )
            print("\n\n\n\ndistance",distance)
            if distance <= request.radius_km:
                device_ids_in_area.add(loc.device_id)

        print("device_ids_in_area",device_ids_in_area)
        if device_ids_in_area:
            # Get tokens for devices in area
            devices = db.query(Device).filter(
                Device.device_id.in_(device_ids_in_area),
                Device.is_active == True,
                Device.expo_push_token.isnot(None)
            ).all()
            tokens = [d.expo_push_token for d in devices if d.expo_push_token]
        else:
            # Fallback: send to all devices if no location data
            print("No devices found in the specified area. Sending to all devices.")
            #dont send any notification
            return NotificationResponse(
                success=True,
                devices_notified=0,
                message="No devices found matching criteria"
            )
            devices = db.query(Device).filter(
                Device.is_active == True,
                Device.expo_push_token.isnot(None)
            ).all()
            tokens = [d.expo_push_token for d in devices if d.expo_push_token]
                    
    elif request.target == NotificationTarget.DEVICES:
        if not request.device_ids:
            raise HTTPException(
                status_code=400,
                detail="device_ids required for device targeting"
            )
        
        devices = db.query(Device).filter(
            Device.device_id.in_(request.device_ids),
            Device.is_active == True,
            Device.expo_push_token.isnot(None)
        ).all()
        tokens = [d.expo_push_token for d in devices if d.expo_push_token]
    
    if not tokens:
        return NotificationResponse(
            success=True,
            devices_notified=0,
            message="No devices found matching criteria"
        )
    
    # Build notification data
    data = {
        "type": request.notification_type.value,
        "sent_by": {
            "authority_id": current_authority.id,
            "organization_name": current_authority.organization_name
        }
    }
    
    if request.disaster_id:
        data["disaster_id"] = request.disaster_id
    
    if request.latitude and request.longitude:
        data["latitude"] = request.latitude
        data["longitude"] = request.longitude
        
    if request.radius_km:
        data["radius_km"] = request.radius_km
    
    # Set priority based on type
    priority = "high" if request.notification_type in [
        NotificationType.EMERGENCY_BROADCAST,
        NotificationType.EVACUATION_ALERT
    ] else "normal"
    
    # Send notification
    await NotificationService.send_push_notification(
        expo_tokens=tokens,
        title=request.title,
        body=request.body,
        data=data,
        priority=priority
    )
    
    return NotificationResponse(
        success=True,
        devices_notified=len(tokens),
        message=f"Notification sent to {len(tokens)} devices"
    )
