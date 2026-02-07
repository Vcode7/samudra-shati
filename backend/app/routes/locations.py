from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional

from ..database import get_db
from ..models import Device, DisasterReport, UserLocationLog, DisasterAlertStatus
from ..schemas import LocationUpdate, RadiusCheckResponse
from ..services.alert_service import AlertService

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.post("/update", response_model=RadiusCheckResponse)
async def update_user_location(
    location_data: LocationUpdate,
    db: Session = Depends(get_db)
):
    """
    Receive user location update during emergency mode.
    
    Returns whether user is in the danger zone and should vibrate.
    No authentication required - uses device_id.
    """
    # Get the disaster
    disaster = db.query(DisasterReport).filter(
        DisasterReport.id == location_data.disaster_id
    ).first()
    
    if not disaster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disaster not found"
        )
    
    # Calculate distance from disaster
    distance_km = AlertService.calculate_distance(
        location_data.latitude,
        location_data.longitude,
        disaster.latitude,
        disaster.longitude
    )
    
    # Check if in danger zone
    in_danger_zone = distance_km <= disaster.danger_radius_km
    
    # Should vibrate only if emergency is active AND user is in danger zone
    should_vibrate = (
        in_danger_zone and 
        disaster.alert_status == DisasterAlertStatus.EMERGENCY_ACTIVE
    )
    
    # Get device's user_id if linked
    device = db.query(Device).filter(
        Device.device_id == location_data.device_id
    ).first()
    user_id = device.user_id if device else None
    
    # Log the location update
    location_log = UserLocationLog(
        device_id=location_data.device_id,
        user_id=user_id,
        disaster_report_id=disaster.id,
        latitude=location_data.latitude,
        longitude=location_data.longitude,
        accuracy=location_data.accuracy,
        distance_km=distance_km,
        in_danger_zone=in_danger_zone
    )
    db.add(location_log)
    db.commit()
    
    return RadiusCheckResponse(
        in_danger_zone=in_danger_zone,
        distance_km=round(distance_km, 3),
        should_vibrate=should_vibrate,
        disaster_id=disaster.id,
        disaster_latitude=disaster.latitude,
        disaster_longitude=disaster.longitude,
        danger_radius_km=disaster.danger_radius_km
    )


@router.get("/check-radius/{disaster_id}", response_model=RadiusCheckResponse)
async def check_radius(
    disaster_id: int,
    lat: float,
    lng: float,
    db: Session = Depends(get_db)
):
    """
    Check if a location is within the danger radius of a disaster.
    
    This is a quick check without logging - for polling.
    """
    disaster = db.query(DisasterReport).filter(
        DisasterReport.id == disaster_id
    ).first()
    
    if not disaster:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Disaster not found"
        )
    
    distance_km = AlertService.calculate_distance(lat, lng, disaster.latitude, disaster.longitude)
    in_danger_zone = distance_km <= disaster.danger_radius_km
    
    should_vibrate = (
        in_danger_zone and 
        disaster.alert_status == DisasterAlertStatus.EMERGENCY_ACTIVE
    )
    
    return RadiusCheckResponse(
        in_danger_zone=in_danger_zone,
        distance_km=round(distance_km, 3),
        should_vibrate=should_vibrate,
        disaster_id=disaster.id,
        disaster_latitude=disaster.latitude,
        disaster_longitude=disaster.longitude,
        danger_radius_km=disaster.danger_radius_km
    )


@router.get("/emergency-zones")
async def get_emergency_zones(
    db: Session = Depends(get_db)
):
    """
    Get all currently active emergency zones.
    
    Returns list of disasters with active emergency mode.
    """
    active_emergencies = db.query(DisasterReport).filter(
        DisasterReport.alert_status == DisasterAlertStatus.EMERGENCY_ACTIVE
    ).all()
    
    return [
        {
            "disaster_id": d.id,
            "latitude": d.latitude,
            "longitude": d.longitude,
            "danger_radius_km": d.danger_radius_km,
            "location_name": d.location_name,
            "severity_level": d.severity_level,
            "confirmation_count": d.verification_count_yes
        }
        for d in active_emergencies
    ]
