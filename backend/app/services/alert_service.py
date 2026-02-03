import math
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from ..models import User, Authority, DisasterReport


class AlertService:
    """
    Service for calculating alert recipients and distribution logic
    """
    
    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two coordinates using Haversine formula
        
        Returns: distance in kilometers
        """
        # Earth radius in kilometers
        R = 6371.0
        
        # Convert to radians
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        # Differences
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        # Haversine formula
        a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        distance = R * c
        return distance
    
    @staticmethod
    def get_nearby_users(
        latitude: float,
        longitude: float,
        radius_km: float,
        db: Session,
        exclude_user_id: int = None
    ) -> List[User]:
        """
        Get users within a certain radius of a location
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            radius_km: Radius in kilometers
            db: Database session
            exclude_user_id: User ID to exclude (e.g., the reporter)
        
        Returns:
            List of nearby users with push tokens
        """
        # Get all verified users with push tokens
        query = db.query(User).filter(
            User.is_verified == True,
            User.expo_push_token.isnot(None)
        )
        
        if exclude_user_id:
            query = query.filter(User.id != exclude_user_id)
        
        all_users = query.all()
        
        # Filter by distance
        # Note: In production, use PostGIS or similar for efficient geospatial queries
        nearby_users = []
        
        # For now, we'll send to all users (since we don't store user locations)
        # In a real app, you'd track user's last known location or home location
        # TODO: Implement proper geospatial filtering
        
        return all_users[:100]  # Limit to 100 users for now
    
    @staticmethod
    def get_relevant_authorities(
        latitude: float,
        longitude: float,
        db: Session
    ) -> List[Authority]:
        """
        Get authorities whose operational radius includes the disaster location
        
        Args:
            latitude: Disaster latitude
            longitude: Disaster longitude
            db: Database session
        
        Returns:
            List of relevant authorities
        """
        # Get all active authorities with push tokens
        authorities = db.query(Authority).filter(
            Authority.is_active == True,
            Authority.expo_push_token.isnot(None)
        ).all()
        
        # Filter by operational radius
        relevant_authorities = []
        
        for authority in authorities:
            distance = AlertService.calculate_distance(
                latitude, longitude,
                authority.base_latitude, authority.base_longitude
            )
            
            if distance <= authority.operational_radius_km:
                relevant_authorities.append(authority)
        
        return relevant_authorities
    
    @staticmethod
    def prepare_multilingual_message(
        template_key: str,
        location: str = "",
        severity: int = 5
    ) -> dict:
        """
        Prepare multi-language alert messages
        
        Args:
            template_key: Type of message ('disaster_alert', 'verification_request', etc.)
            location: Location name
            severity: Severity level
        
        Returns:
            Dict with messages in different languages
        """
        messages = {}
        
        if template_key == "disaster_alert":
            messages = {
                "en": {
                    "title": "🚨 Disaster Alert",
                    "body": f"A disaster has been reported near {location}. Stay alert and follow safety guidelines."
                },
                "hi": {
                    "title": "🚨 आपदा चेतावनी",
                    "body": f"{location} के पास एक आपदा की सूचना मिली है। सतर्क रहें और सुरक्षा दिशानिर्देशों का पालन करें।"
                },
                "ta": {
                    "title": "🚨 பேரிடர் எச்சரிக்கை",
                    "body": f"{location} அருகில் ஒரு பேரிடர் பதிவாகியுள்ளது. எச்சரிக்கையாக இருங்கள் மற்றும் பாதுகாப்பு வழிகாட்டுதல்களைப் பின்பற்றவும்."
                }
            }
        
        elif template_key == "verification_request":
            messages = {
                "en": {
                    "title": "⚠️ Verification Needed",
                    "body": f"Can you verify a disaster report near {location}? Your response helps others."
                },
                "hi": {
                    "title": "⚠️ सत्यापन आवश्यक",
                    "body": f"क्या आप {location} के पास आपदा रिपोर्ट की पुष्टि कर सकते हैं? आपकी प्रतिक्रिया दूसरों की मदद करती है।"
                },
                "ta": {
                    "title": "⚠️ சரிபார்ப்பு தேவை",
                    "body": f"{location} அருகில் உள்ள பேரிடர் அறிக்கையை சரிபார்க்க முடியுமா? உங்கள் பதில் மற்றவர்களுக்கு உதவுகிறது."
                }
            }
        
        elif template_key == "authority_response":
            messages = {
                "en": {
                    "title": "✅ Help is on the way",
                    "body": f"Authorities have been notified about the situation at {location}."
                },
                "hi": {
                    "title": "✅ मदद आ रही है",
                    "body": f"{location} की स्थिति के बारे में अधिकारियों को सूचित किया गया है।"
                },
                "ta": {
                    "title": "✅ உதவி வருகிறது",
                    "body": f"{location} இல் உள்ள நிலைமை குறித்து அதிகாரிகளுக்கு தெரிவிக்கப்பட்டுள்ளது."
                }
            }
        
        return messages
