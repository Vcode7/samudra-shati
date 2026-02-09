"""
Unified zones routes for authority dashboard
Provides a single API to manage safe areas and service centers
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ..database import get_db
from ..models import SafeArea, ServiceCenter, ServiceCenterType, Authority
from ..dependencies import get_current_authority
from ..services.alert_service import AlertService

router = APIRouter(prefix="/api/zones", tags=["zones"])


class ZoneBase(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 1.0
    description: Optional[str] = None


class SafeZoneCreate(ZoneBase):
    name: Optional[str] = None
    capacity: Optional[int] = None
    disaster_id: Optional[int] = None


class ServiceZoneCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    service_type: str  # 'healthcare', 'report', 'helpcenter'
    contact_info: Optional[str] = None


class ZoneResponse(BaseModel):
    id: int
    zone_type: str  # "safe" or "service"
    latitude: float
    longitude: float
    radius_km: float
    description: Optional[str]
    name: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


@router.get("", response_model=List[ZoneResponse])
async def get_all_zones(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 50.0,
    db: Session = Depends(get_db)
):
    """
    Get all active zones (safe areas and service centers).
    Optionally filter by proximity to a location.
    """
    zones = []
    
    # Get safe areas
    safe_areas = db.query(SafeArea).filter(SafeArea.is_active == True).all()
    for area in safe_areas:
        if lat and lng:
            distance = AlertService.calculate_distance(lat, lng, area.latitude, area.longitude)
            if distance > radius_km:
                continue
        
        zones.append(ZoneResponse(
            id=area.id,
            zone_type="safe",
            latitude=area.latitude,
            longitude=area.longitude,
            radius_km=area.radius_km,
            description=area.description,
            name=None,
            is_active=area.is_active,
            created_at=area.created_at
        ))
    
    # Get service centers
    service_centers = db.query(ServiceCenter).filter(ServiceCenter.is_active == True).all()
    for center in service_centers:
        if lat and lng:
            distance = AlertService.calculate_distance(lat, lng, center.latitude, center.longitude)
            if distance > radius_km:
                continue
        
        zones.append(ZoneResponse(
            id=center.id,
            zone_type="service",
            latitude=center.latitude,
            longitude=center.longitude,
            radius_km=center.radius_km,
            description=center.address,
            name=center.name,
            is_active=center.is_active,
            created_at=center.created_at
        ))
    
    return zones


@router.post("/safe", response_model=ZoneResponse)
async def create_safe_zone(
    data: SafeZoneCreate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """Create a new safe zone (alias for /authorities/safe-areas)"""
    safe_area = SafeArea(
        latitude=data.latitude,
        longitude=data.longitude,
        radius_km=data.radius_km,
        description=data.description,
        disaster_id=data.disaster_id,
        created_by_authority_id=current_authority.id,
        is_active=True
    )
    
    db.add(safe_area)
    db.commit()
    db.refresh(safe_area)
    
    return ZoneResponse(
        id=safe_area.id,
        zone_type="safe",
        latitude=safe_area.latitude,
        longitude=safe_area.longitude,
        radius_km=safe_area.radius_km,
        description=safe_area.description,
        name=None,
        is_active=safe_area.is_active,
        created_at=safe_area.created_at
    )


@router.post("/service", response_model=ZoneResponse)
async def create_service_zone(
    data: ServiceZoneCreate,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """Create a new service center"""
    # Map frontend service_type to backend center_type enum
    type_mapping = {
        'healthcare': ServiceCenterType.HOSPITAL,
        'report': ServiceCenterType.REPORT_CENTER,
        'helpcenter': ServiceCenterType.RELIEF_CENTER,
    }
    center_type = type_mapping.get(data.service_type, ServiceCenterType.RELIEF_CENTER)
    
    center = ServiceCenter(
        name=data.name,
        center_type=center_type,
        latitude=data.latitude,
        longitude=data.longitude,
        radius_km=1.0,  # default radius for service centers
        contact_number=data.contact_info,
        address=data.name,  # use name as address placeholder
        created_by_authority_id=current_authority.id,
        is_active=True
    )
    
    db.add(center)
    db.commit()
    db.refresh(center)
    
    return ZoneResponse(
        id=center.id,
        zone_type="service",
        latitude=center.latitude,
        longitude=center.longitude,
        radius_km=center.radius_km,
        description=center.address,
        name=center.name,
        is_active=center.is_active,
        created_at=center.created_at
    )


@router.delete("/{zone_type}/{zone_id}")
async def delete_zone(
    zone_type: str,
    zone_id: int,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Delete (deactivate) a zone.
    zone_type must be "safe" or "service"
    """
    if zone_type == "safe":
        zone = db.query(SafeArea).filter(
            SafeArea.id == zone_id,
            SafeArea.created_by_authority_id == current_authority.id
        ).first()
        
        if not zone:
            raise HTTPException(status_code=404, detail="Safe zone not found")
        
        zone.is_active = False
        zone.updated_at = datetime.utcnow()
        
    elif zone_type == "service":
        zone = db.query(ServiceCenter).filter(
            ServiceCenter.id == zone_id,
            ServiceCenter.created_by_authority_id == current_authority.id
        ).first()
        
        if not zone:
            raise HTTPException(status_code=404, detail="Service zone not found")
        
        zone.is_active = False
        zone.updated_at = datetime.utcnow()
        
    else:
        raise HTTPException(status_code=400, detail="zone_type must be 'safe' or 'service'")
    
    db.commit()
    
    return {"success": True, "message": f"{zone_type.title()} zone deactivated"}
