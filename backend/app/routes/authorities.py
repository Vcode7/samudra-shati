from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from ..database import get_db
from ..models import Authority, Equipment
from ..schemas import (
    AuthorityLogin, AuthorityCreate, AuthorityResponse,
    AuthorityUpdate, Token,
    EquipmentCreate, EquipmentUpdate, EquipmentResponse
)
from ..auth import verify_password, get_password_hash, create_access_token
from ..dependencies import get_current_authority

router = APIRouter(prefix="/api/authorities", tags=["authorities"])


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
    db: Session = Depends(get_db)
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
