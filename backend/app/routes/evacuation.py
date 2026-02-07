import math
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime, timedelta

from ..database import get_db
from ..models import SafeArea, DeviceLocation, EvacuationAlert, DisasterReport, DisasterStatus, DisasterAlertStatus, Device
from ..schemas import DeviceLocationUpdate, EvacuationDirectionResponse, SafeAreaResponse
from ..services.alert_service import AlertService
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/api", tags=["evacuation"])


# Movement analysis constants
CROWD_ALIGNMENT_THRESHOLD = 0.60  # 60% of users moving in same direction
DIRECTION_TOLERANCE_DEGREES = 30  # Within 30 degrees counts as same direction
EVACUATION_ALERT_THROTTLE_MINUTES = 3  # Minimum time between alerts per area
ANALYSIS_TIME_WINDOW_MINUTES = 5  # Consider movement in last 5 minutes
MIN_DEVICES_FOR_CROWD_ANALYSIS = 5  # Minimum devices needed for crowd analysis


def hash_device_id(device_id: str) -> str:
    """Hash device ID for anonymity"""
    return hashlib.sha256(device_id.encode()).hexdigest()[:32]


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate bearing from point 1 to point 2 in degrees (0-360)"""
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    
    x = math.sin(dlon) * math.cos(lat2_rad)
    y = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon)
    
    bearing = math.atan2(x, y)
    bearing = math.degrees(bearing)
    bearing = (bearing + 360) % 360
    
    return bearing


def angle_difference(angle1: float, angle2: float) -> float:
    """Calculate the smallest difference between two angles"""
    diff = abs(angle1 - angle2)
    return min(diff, 360 - diff)


def analyze_crowd_movement(device_locations: List[DeviceLocation]) -> Optional[dict]:
    """
    Analyze crowd movement to detect evacuation patterns.
    Returns direction if ≥60% of devices are moving in the same direction.
    """
    if len(device_locations) < MIN_DEVICES_FOR_CROWD_ANALYSIS:
        return None
    
    # Get devices with valid heading data
    devices_with_heading = [d for d in device_locations if d.heading is not None]
    
    if len(devices_with_heading) < MIN_DEVICES_FOR_CROWD_ANALYSIS:
        return None
    
    # Try to find a dominant direction
    headings = [d.heading for d in devices_with_heading]
    
    # For each heading, count how many others are within tolerance
    best_direction = None
    best_count = 0
    
    for i, h1 in enumerate(headings):
        count = sum(1 for h2 in headings if angle_difference(h1, h2) <= DIRECTION_TOLERANCE_DEGREES)
        if count > best_count:
            best_count = count
            best_direction = h1
    
    alignment_ratio = best_count / len(headings)
    
    if alignment_ratio >= CROWD_ALIGNMENT_THRESHOLD:
        # Calculate average direction of aligned devices
        aligned_headings = [h for h in headings if angle_difference(h, best_direction) <= DIRECTION_TOLERANCE_DEGREES]
        
        # Use vector averaging for circular data
        sin_sum = sum(math.sin(math.radians(h)) for h in aligned_headings)
        cos_sum = sum(math.cos(math.radians(h)) for h in aligned_headings)
        avg_direction = math.degrees(math.atan2(sin_sum, cos_sum))
        avg_direction = (avg_direction + 360) % 360
        
        return {
            "direction": avg_direction,
            "confidence": alignment_ratio,
            "device_count": len(aligned_headings)
        }
    
    return None


@router.post("/devices/location")
async def update_device_location(
    location_data: DeviceLocationUpdate,
    db: Session = Depends(get_db)
):
    """
    Update device location for crowd movement analysis.
    
    Device ID is hashed for anonymity.
    Called in background during active disasters.
    """
    device_hash = hash_device_id(location_data.device_id)
    
    # Create new location record
    device_location = DeviceLocation(
        device_hash=device_hash,
        latitude=location_data.latitude,
        longitude=location_data.longitude,
        heading=location_data.heading,
        speed=location_data.speed
    )
    
    db.add(device_location)
    db.commit()
    
    # Clean up old location data (older than 10 minutes)
    cutoff_time = datetime.utcnow() - timedelta(minutes=10)
    db.query(DeviceLocation).filter(
        DeviceLocation.timestamp < cutoff_time
    ).delete()
    db.commit()
    
    return {"success": True, "message": "Location updated"}


@router.get("/evacuation/direction", response_model=EvacuationDirectionResponse)
async def get_evacuation_direction(
    lat: float,
    lng: float,
    disaster_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get recommended evacuation direction for a user.
    
    Returns:
    1. Nearest authority-defined safe area (priority)
    2. Crowd movement direction if no safe area nearby
    """
    # 1. Look for nearest active safe area
    safe_areas = db.query(SafeArea).filter(
        SafeArea.is_active == True
    ).all()
    
    nearest_safe_area = None
    min_distance = float('inf')
    
    for area in safe_areas:
        distance = AlertService.calculate_distance(lat, lng, area.latitude, area.longitude)
        if distance < min_distance:
            min_distance = distance
            nearest_safe_area = area
    
    # If safe area found within reasonable distance (30km)
    if nearest_safe_area and min_distance <= 30:
        bearing = calculate_bearing(lat, lng, nearest_safe_area.latitude, nearest_safe_area.longitude)
        
        # Estimate walking time (average 5 km/h)
        walking_speed_kmh = 5.0
        estimated_time = (min_distance / walking_speed_kmh) * 60  # minutes
        
        return EvacuationDirectionResponse(
            has_safe_area=True,
            safe_area=SafeAreaResponse(
                id=nearest_safe_area.id,
                latitude=nearest_safe_area.latitude,
                longitude=nearest_safe_area.longitude,
                radius_km=nearest_safe_area.radius_km,
                description=nearest_safe_area.description,
                is_active=nearest_safe_area.is_active,
                created_by_authority_id=nearest_safe_area.created_by_authority_id,
                disaster_id=nearest_safe_area.disaster_id,
                created_at=nearest_safe_area.created_at
            ),
            distance_km=round(min_distance, 2),
            estimated_time_minutes=round(estimated_time, 1),
            bearing_to_safe_area=round(bearing, 1)
        )
    
    # 2. Analyze crowd movement if no safe area
    cutoff_time = datetime.utcnow() - timedelta(minutes=ANALYSIS_TIME_WINDOW_MINUTES)
    
    # Get recent device locations in the area (within 5km)
    all_recent_locations = db.query(DeviceLocation).filter(
        DeviceLocation.timestamp >= cutoff_time
    ).all()
    
    nearby_locations = [
        loc for loc in all_recent_locations
        if AlertService.calculate_distance(lat, lng, loc.latitude, loc.longitude) <= 5.0
    ]
    
    crowd_analysis = analyze_crowd_movement(nearby_locations)
    
    if crowd_analysis:
        return EvacuationDirectionResponse(
            has_safe_area=False,
            crowd_direction=round(crowd_analysis["direction"], 1),
            crowd_confidence=round(crowd_analysis["confidence"], 2)
        )
    
    # No safe area and no crowd direction available
    return EvacuationDirectionResponse(
        has_safe_area=False
    )


@router.post("/evacuation/trigger-crowd-alert")
async def trigger_crowd_evacuation_alert(
    lat: float,
    lng: float,
    disaster_id: int,
    db: Session = Depends(get_db)
):
    """
    Internal endpoint to check and trigger crowd evacuation alerts.
    Called periodically during active disasters.
    
    Respects throttling: max 1 alert per 3 minutes per area.
    """
    # Check throttling
    throttle_cutoff = datetime.utcnow() - timedelta(minutes=EVACUATION_ALERT_THROTTLE_MINUTES)
    
    recent_alerts = db.query(EvacuationAlert).filter(
        and_(
            EvacuationAlert.sent_at >= throttle_cutoff,
            EvacuationAlert.disaster_id == disaster_id
        )
    ).all()
    
    # Check if any recent alert is in the same area (within 2km)
    for alert in recent_alerts:
        if AlertService.calculate_distance(lat, lng, alert.area_latitude, alert.area_longitude) <= 2.0:
            return {"triggered": False, "reason": "throttled"}
    
    # Analyze crowd movement
    cutoff_time = datetime.utcnow() - timedelta(minutes=ANALYSIS_TIME_WINDOW_MINUTES)
    
    all_recent_locations = db.query(DeviceLocation).filter(
        DeviceLocation.timestamp >= cutoff_time
    ).all()
    
    nearby_locations = [
        loc for loc in all_recent_locations
        if AlertService.calculate_distance(lat, lng, loc.latitude, loc.longitude) <= 5.0
    ]
    
    crowd_analysis = analyze_crowd_movement(nearby_locations)
    
    if not crowd_analysis:
        return {"triggered": False, "reason": "no_crowd_pattern"}
    
    # Create alert record
    evacuation_alert = EvacuationAlert(
        area_latitude=lat,
        area_longitude=lng,
        direction_degrees=crowd_analysis["direction"],
        disaster_id=disaster_id
    )
    db.add(evacuation_alert)
    db.commit()
    
    # Get nearby devices to notify
    nearby_devices = db.query(Device).filter(
        Device.is_active == True,
        Device.expo_push_token.isnot(None)
    ).all()
    
    tokens = [d.expo_push_token for d in nearby_devices if d.expo_push_token]
    
    if tokens:
        # Prepare multilingual evacuation message
        direction_compass = get_compass_direction(crowd_analysis["direction"])
        
        messages = {
            "en": {
                "title": "🚶 Community Evacuation Route",
                "body": f"Community is moving towards {direction_compass}. Follow the highlighted direction on the map."
            },
            "hi": {
                "title": "🚶 सामुदायिक निकासी मार्ग",
                "body": f"समुदाय {direction_compass} की ओर जा रहा है। मानचित्र पर हाइलाइट की गई दिशा का पालन करें।"
            },
            "ta": {
                "title": "🚶 சமூக வெளியேற்ற பாதை",
                "body": f"சமூகம் {direction_compass} நோக்கி நகர்கிறது। வரைபடத்தில் சிறப்பிக்கப்பட்ட திசையைப் பின்பற்றுங்கள்."
            }
        }
        
        await NotificationService.send_push_notification(
            expo_tokens=tokens,
            title=messages["en"]["title"],
            body=messages["en"]["body"],
            data={
                "type": "evacuation_route",
                "disaster_id": disaster_id,
                "direction_degrees": crowd_analysis["direction"],
                "latitude": lat,
                "longitude": lng,
                "messages": messages
            },
            priority="high"
        )
    
    return {
        "triggered": True,
        "direction": crowd_analysis["direction"],
        "confidence": crowd_analysis["confidence"],
        "devices_notified": len(tokens)
    }


def get_compass_direction(degrees: float) -> str:
    """Convert degrees to compass direction"""
    directions = ["North", "NE", "East", "SE", "South", "SW", "West", "NW"]
    index = round(degrees / 45) % 8
    return directions[index]
