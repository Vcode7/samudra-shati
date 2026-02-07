from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models import ServiceCenter, ServiceCenterType, Authority
from ..dependencies import get_current_authority
from ..services.alert_service import AlertService
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["service-centers"])


# Schemas
class ServiceCenterCreate(BaseModel):
    name: str
    center_type: ServiceCenterType
    latitude: float
    longitude: float
    radius_km: float = 0.5
    contact_number: Optional[str] = None
    address: Optional[str] = None


class ServiceCenterUpdate(BaseModel):
    name: Optional[str] = None
    radius_km: Optional[float] = None
    contact_number: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceCenterResponse(BaseModel):
    id: int
    name: str
    center_type: ServiceCenterType
    latitude: float
    longitude: float
    radius_km: float
    contact_number: Optional[str]
    address: Optional[str]
    is_active: bool
    created_by_authority_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# Authority endpoints
@router.post("/authorities/service-centers", response_model=ServiceCenterResponse)
async def create_service_center(
    data: ServiceCenterCreate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """Create a new service center (authority only)"""
    center = ServiceCenter(
        name=data.name,
        center_type=data.center_type,
        latitude=data.latitude,
        longitude=data.longitude,
        radius_km=data.radius_km,
        contact_number=data.contact_number,
        address=data.address,
        created_by_authority_id=current_authority.id,
        is_active=True
    )
    
    db.add(center)
    db.commit()
    db.refresh(center)
    
    return center


@router.get("/authorities/service-centers", response_model=List[ServiceCenterResponse])
async def get_authority_service_centers(
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """Get all service centers created by the current authority"""
    centers = db.query(ServiceCenter).filter(
        ServiceCenter.created_by_authority_id == current_authority.id
    ).order_by(ServiceCenter.created_at.desc()).all()
    
    return centers


@router.put("/authorities/service-centers/{center_id}", response_model=ServiceCenterResponse)
async def update_service_center(
    center_id: int,
    data: ServiceCenterUpdate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """Update a service center (authority only, own centers)"""
    center = db.query(ServiceCenter).filter(
        ServiceCenter.id == center_id,
        ServiceCenter.created_by_authority_id == current_authority.id
    ).first()
    
    if not center:
        raise HTTPException(status_code=404, detail="Service center not found")
    
    if data.name is not None:
        center.name = data.name
    if data.radius_km is not None:
        center.radius_km = data.radius_km
    if data.contact_number is not None:
        center.contact_number = data.contact_number
    if data.address is not None:
        center.address = data.address
    if data.is_active is not None:
        center.is_active = data.is_active
    
    center.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(center)
    
    return center


@router.delete("/authorities/service-centers/{center_id}")
async def delete_service_center(
    center_id: int,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """Deactivate a service center (soft delete)"""
    center = db.query(ServiceCenter).filter(
        ServiceCenter.id == center_id,
        ServiceCenter.created_by_authority_id == current_authority.id
    ).first()
    
    if not center:
        raise HTTPException(status_code=404, detail="Service center not found")
    
    center.is_active = False
    center.updated_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Service center deactivated"}


# Public endpoints
@router.get("/service-centers/nearby", response_model=List[ServiceCenterResponse])
async def get_nearby_service_centers(
    lat: float,
    lng: float,
    radius_km: float = 30.0,
    center_type: Optional[ServiceCenterType] = None,
    db: Session = Depends(get_db)
):
    """Get active service centers near a location (public)"""
    query = db.query(ServiceCenter).filter(ServiceCenter.is_active == True)
    
    if center_type:
        query = query.filter(ServiceCenter.center_type == center_type)
    
    all_centers = query.all()
    
    # Filter by distance
    nearby = []
    for center in all_centers:
        distance = AlertService.calculate_distance(lat, lng, center.latitude, center.longitude)
        if distance <= radius_km:
            nearby.append(center)
    
    # Sort by distance
    nearby.sort(key=lambda c: AlertService.calculate_distance(lat, lng, c.latitude, c.longitude))
    
    return nearby[:50]
