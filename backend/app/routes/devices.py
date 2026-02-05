from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from ..database import get_db
from ..models import Device, User
from ..schemas import (
    DeviceRegister, DeviceLinkUser, DeviceResponse, DeviceStatsResponse
)
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.post("/register", response_model=DeviceResponse)
async def register_device(
    device_data: DeviceRegister,
    db: Session = Depends(get_db)
):
    """
    Register a device for push notifications.
    
    This endpoint does NOT require authentication.
    Devices can be registered before user login to receive alerts.
    """
    # Validate expo push token format
    token = device_data.expo_push_token
    if not (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Expo push token format"
        )
    
    # Check if device already exists
    existing_device = db.query(Device).filter(
        Device.device_id == device_data.device_id
    ).first()
    
    if existing_device:
        # Update existing device
        existing_device.expo_push_token = device_data.expo_push_token
        existing_device.platform = device_data.platform
        existing_device.app_install_id = device_data.app_install_id
        existing_device.last_seen = datetime.utcnow()
        existing_device.is_active = True
        existing_device.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_device)
        return existing_device
    
    # Create new device
    new_device = Device(
        device_id=device_data.device_id,
        expo_push_token=device_data.expo_push_token,
        platform=device_data.platform,
        app_install_id=device_data.app_install_id,
        is_active=True
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    
    return new_device


@router.put("/link-user", response_model=DeviceResponse)
async def link_device_to_user(
    link_data: DeviceLinkUser,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Link a device to the current logged-in user.
    
    This should be called after user login to associate
    the device with their account.
    """
    device = db.query(Device).filter(
        Device.device_id == link_data.device_id
    ).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found. Please register device first."
        )
    
    device.user_id = current_user.id
    device.last_seen = datetime.utcnow()
    device.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(device)
    
    # Also update user's push token
    current_user.expo_push_token = device.expo_push_token
    db.commit()
    
    return device


@router.post("/heartbeat")
async def device_heartbeat(
    device_data: DeviceLinkUser,
    db: Session = Depends(get_db)
):
    """
    Update device last seen timestamp.
    Called periodically by app to keep device active.
    """
    device = db.query(Device).filter(
        Device.device_id == device_data.device_id
    ).first()
    
    if device:
        device.last_seen = datetime.utcnow()
        device.is_active = True
        db.commit()
        return {"success": True, "message": "Heartbeat received"}
    
    return {"success": False, "message": "Device not found"}


@router.get("/stats", response_model=DeviceStatsResponse)
async def get_device_stats(
    db: Session = Depends(get_db)
):
    """
    Get statistics about registered devices.
    Useful for admin/monitoring purposes.
    """
    total = db.query(Device).count()
    active = db.query(Device).filter(Device.is_active == True).count()
    with_users = db.query(Device).filter(Device.user_id.isnot(None)).count()
    android = db.query(Device).filter(Device.platform == "android").count()
    ios = db.query(Device).filter(Device.platform == "ios").count()
    
    return DeviceStatsResponse(
        total_devices=total,
        active_devices=active,
        devices_with_users=with_users,
        android_devices=android,
        ios_devices=ios
    )


@router.delete("/unregister/{device_id}")
async def unregister_device(
    device_id: str,
    db: Session = Depends(get_db)
):
    """
    Unregister a device (mark as inactive).
    Does not delete the record for analytics purposes.
    """
    device = db.query(Device).filter(
        Device.device_id == device_id
    ).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    device.is_active = False
    device.updated_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Device unregistered"}
