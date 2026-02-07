from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..database import get_db
from ..models import SafeArea, Authority
from ..schemas import SafeAreaCreate, SafeAreaUpdate, SafeAreaResponse
from ..dependencies import get_current_authority
from ..services.alert_service import AlertService

router = APIRouter(prefix="/api", tags=["safe-areas"])


@router.post("/authorities/safe-areas", response_model=SafeAreaResponse)
async def create_safe_area(
    safe_area_data: SafeAreaCreate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Create a new safe area (authority only).
    
    Safe areas are evacuation zones that users should move toward during disasters.
    """
    safe_area = SafeArea(
        latitude=safe_area_data.latitude,
        longitude=safe_area_data.longitude,
        radius_km=safe_area_data.radius_km,
        description=safe_area_data.description,
        disaster_id=safe_area_data.disaster_id,
        created_by_authority_id=current_authority.id,
        is_active=True
    )
    
    db.add(safe_area)
    db.commit()
    db.refresh(safe_area)
    
    return safe_area


@router.get("/safe-areas/nearby", response_model=List[SafeAreaResponse])
async def get_nearby_safe_areas(
    lat: float,
    lng: float,
    radius_km: float = 20.0,
    db: Session = Depends(get_db)
):
    """
    Get active safe areas near a location.
    
    No authentication required - allows all users to find safe zones.
    """
    # Get all active safe areas
    safe_areas = db.query(SafeArea).filter(
        SafeArea.is_active == True
    ).all()
    
    # Filter by distance
    nearby_safe_areas = []
    for area in safe_areas:
        distance = AlertService.calculate_distance(
            lat, lng,
            area.latitude, area.longitude
        )
        if distance <= radius_km:
            nearby_safe_areas.append(area)
    
    # Sort by distance (nearest first)
    nearby_safe_areas.sort(
        key=lambda a: AlertService.calculate_distance(lat, lng, a.latitude, a.longitude)
    )
    
    return nearby_safe_areas[:20]  # Limit to 20 results


@router.get("/authorities/safe-areas", response_model=List[SafeAreaResponse])
async def get_authority_safe_areas(
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Get all safe areas created by the current authority.
    """
    safe_areas = db.query(SafeArea).filter(
        SafeArea.created_by_authority_id == current_authority.id
    ).order_by(SafeArea.created_at.desc()).all()
    
    return safe_areas


@router.put("/authorities/safe-areas/{safe_area_id}", response_model=SafeAreaResponse)
async def update_safe_area(
    safe_area_id: int,
    update_data: SafeAreaUpdate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Update a safe area (authority only, own areas only).
    """
    safe_area = db.query(SafeArea).filter(
        SafeArea.id == safe_area_id,
        SafeArea.created_by_authority_id == current_authority.id
    ).first()
    
    if not safe_area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Safe area not found or not owned by you"
        )
    
    if update_data.radius_km is not None:
        safe_area.radius_km = update_data.radius_km
    
    if update_data.description is not None:
        safe_area.description = update_data.description
    
    if update_data.is_active is not None:
        safe_area.is_active = update_data.is_active
    
    safe_area.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(safe_area)
    
    return safe_area


@router.delete("/authorities/safe-areas/{safe_area_id}")
async def deactivate_safe_area(
    safe_area_id: int,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Deactivate a safe area (soft delete).
    """
    safe_area = db.query(SafeArea).filter(
        SafeArea.id == safe_area_id,
        SafeArea.created_by_authority_id == current_authority.id
    ).first()
    
    if not safe_area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Safe area not found or not owned by you"
        )
    
    safe_area.is_active = False
    safe_area.updated_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Safe area deactivated"}
