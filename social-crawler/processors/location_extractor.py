"""
Location extraction from text content
"""
import re
from typing import Optional, Tuple

from config import Config


class LocationExtractor:
    """
    Extracts location information from disaster-related text.
    """
    
    # Map of cities to their approximate coordinates
    CITY_COORDINATES = {
        "chennai": (13.0827, 80.2707),
        "mumbai": (19.0760, 72.8777),
        "kolkata": (22.5726, 88.3639),
        "visakhapatnam": (17.6868, 83.2185),
        "kochi": (9.9312, 76.2673),
        "mangalore": (12.9141, 74.8560),
        "goa": (15.2993, 74.1240),
        "puri": (19.8135, 85.8312),
        "digha": (21.6280, 87.5090),
        "paradip": (20.3167, 86.6167),
        "cuddalore": (11.7480, 79.7714),
        "nagapattinam": (10.7672, 79.8449),
        "karaikal": (10.9254, 79.8380),
        "puducherry": (11.9139, 79.8145),
        "mahabalipuram": (12.6269, 80.1927),
        "tuticorin": (8.7642, 78.1348),
        "rameswaram": (9.2876, 79.3129),
        "bhuj": (23.2420, 69.6669),
        "porbandar": (21.6417, 69.6293),
        "surat": (21.1702, 72.8311),
    }
    
    # State names and their approximate centers
    STATE_COORDINATES = {
        "tamil nadu": (11.1271, 78.6569),
        "tamilnadu": (11.1271, 78.6569),
        "kerala": (10.8505, 76.2711),
        "karnataka": (15.3173, 75.7139),
        "andhra pradesh": (15.9129, 79.7400),
        "andhra": (15.9129, 79.7400),
        "odisha": (20.9517, 85.0985),
        "west bengal": (22.9868, 87.8550),
        "maharashtra": (19.7515, 75.7139),
        "gujarat": (22.2587, 71.1924),
        "goa": (15.2993, 74.1240),
    }
    
    @staticmethod
    def extract(item) -> Optional[str]:
        """
        Extract location name from text.
        
        Args:
            item: CrawlResult object with text
        
        Returns:
            Location name if found, None otherwise
        """
        text_lower = item.text.lower()
        
        # Check for city names
        for city in Config.COASTAL_CITIES:
            if city.lower() in text_lower:
                return city
        
        # Check for state names
        for state in LocationExtractor.STATE_COORDINATES.keys():
            if state in text_lower:
                return state.title()
        
        # Try to extract location using patterns
        patterns = [
            r"in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
            r"at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
            r"near\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
            r"([A-Z][a-z]+)\s+coast",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, item.text)
            if match:
                return match.group(1)
        
        return None
    
    @staticmethod
    def get_coordinates(location_text: str) -> Optional[Tuple[float, float]]:
        """
        Get coordinates for a location name.
        
        Args:
            location_text: Name of the location
        
        Returns:
            Tuple of (latitude, longitude) if found, None otherwise
        """
        if not location_text:
            return None
        
        location_lower = location_text.lower()
        
        # Check cities
        if location_lower in LocationExtractor.CITY_COORDINATES:
            return LocationExtractor.CITY_COORDINATES[location_lower]
        
        # Check states
        if location_lower in LocationExtractor.STATE_COORDINATES:
            return LocationExtractor.STATE_COORDINATES[location_lower]
        
        # Partial match
        for city, coords in LocationExtractor.CITY_COORDINATES.items():
            if city in location_lower or location_lower in city:
                return coords
        
        return None
