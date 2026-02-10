"""
Background service for detecting region-wide device disconnects.

This service runs periodically to detect when many devices go offline 
in the same region at once, which could indicate a disaster or network failure.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Dict
import json
from collections import defaultdict


class RegionDisconnectDetectorService:
    """Service to detect mass device offline events in same region"""
    
    # Configuration
    CHECK_INTERVAL_MINUTES = 2  # How often to check
    LOOKBACK_MINUTES = 3  # Check devices that went offline in last N minutes
    MIN_DEVICES_THRESHOLD = 10  # Min devices offline to trigger alert
    CLUSTER_RADIUS_KM = 2.0  # Radius to group devices into clusters
    
    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km using Haversine formula"""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  # Earth's radius in km
        
        lat1_rad, lon1_rad = radians(lat1), radians(lon1)
        lat2_rad, lon2_rad = radians(lat2), radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = sin(dlat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        return R * c
    
    @staticmethod
    def cluster_devices_by_location(devices: List[Dict], radius_km: float) -> List[List[Dict]]:
        """
        Cluster devices by proximity using simple distance-based approach.
        
        Args:
            devices: List of device dicts with latitude and longitude
            radius_km: Maximum distance between devices in same cluster
        
        Returns:
            List of clusters, where each cluster is a list of devices
        """
        clusters = []
        remaining_devices = devices.copy()
        
        while remaining_devices:
            # Start new cluster with first remaining device
            seed = remaining_devices.pop(0)
            cluster = [seed]
            
            # Find all devices within radius_km of any device in cluster
            i = 0
            while i < len(remaining_devices):
                device = remaining_devices[i]
                
                # Check if device is close to any device in current cluster
                is_close = False
                for cluster_device in cluster:
                    distance = RegionDisconnectDetectorService.haversine_distance(
                        device['latitude'], device['longitude'],
                        cluster_device['latitude'], cluster_device['longitude']
                    )
                    if distance <= radius_km:
                        is_close = True
                        break
                
                if is_close:
                    cluster.append(device)
                    remaining_devices.pop(i)
                else:
                    i += 1
            
            clusters.append(cluster)
        
        return clusters
    
    @staticmethod
    def calculate_cluster_center(devices: List[Dict]) -> tuple:
        """Calculate center point of a cluster of devices"""
        if not devices:
            return None, None
        
        avg_lat = sum(d['latitude'] for d in devices) / len(devices)
        avg_lng = sum(d['longitude'] for d in devices) / len(devices)
        
        return avg_lat, avg_lng
    
    @staticmethod
    async def check_for_region_disconnects(db: Session):
        """
        Main method to check for region-wide disconnects.
        Should be called periodically (every 1-2 minutes).
        """
        from ..models import Device, RegionDisconnectAlert, AlertStatus
        
        # Calculate cutoff time
        cutoff_time = datetime.utcnow() - timedelta(
            minutes=RegionDisconnectDetectorService.LOOKBACK_MINUTES
        )
        
        # Find devices that recently went offline (or haven't been seen recently)
        # A device is considered "offline" if last_seen_at is older than LOOKBACK_MINUTES
        offline_devices = db.query(Device).filter(
            and_(
                Device.last_seen_at < cutoff_time,
                Device.last_latitude.isnot(None),  # Must have location data
                Device.last_longitude.isnot(None),
                Device.is_active == True  # Was previously active
            )
        ).all()
        
        if len(offline_devices) < RegionDisconnectDetectorService.MIN_DEVICES_THRESHOLD:
            # Not enough devices offline to warrant checking
            return {"message": "Not enough offline devices", "count": len(offline_devices)}
        
        # Convert to dict for clustering
        device_dicts = [
            {
                "device_id": d.device_id,
                "latitude": d.last_latitude,
                "longitude": d.last_longitude,
                "last_seen_at": d.last_seen_at
            }
            for d in offline_devices
        ]
        
        # Cluster devices by location
        clusters = RegionDisconnectDetectorService.cluster_devices_by_location(
            device_dicts,
            RegionDisconnectDetectorService.CLUSTER_RADIUS_KM
        )
        
        # Check if any cluster exceeds threshold
        alerts_created = []
        
        for cluster in clusters:
            if len(cluster) >= RegionDisconnectDetectorService.MIN_DEVICES_THRESHOLD:
                # This cluster has enough devices to trigger an alert
                center_lat, center_lng = RegionDisconnectDetectorService.calculate_cluster_center(cluster)
                
                # Check if we already have a recent alert for this region
                existing_alert = db.query(RegionDisconnectAlert).filter(
                    and_(
                        RegionDisconnectAlert.detected_at > cutoff_time,
                        RegionDisconnectAlert.center_latitude.between(center_lat - 0.05, center_lat + 0.05),
                        RegionDisconnectAlert.center_longitude.between(center_lng - 0.05, center_lng + 0.05)
                    )
                ).first()
                
                if existing_alert:
                    # Already alerted for this region recently
                    continue
                
                # Create new alert
                device_ids = [d['device_id'] for d in cluster]
                
                new_alert = RegionDisconnectAlert(
                    center_latitude=center_lat,
                    center_longitude=center_lng,
                    radius_km=RegionDisconnectDetectorService.CLUSTER_RADIUS_KM,
                    affected_device_count=len(cluster),
                    device_ids=json.dumps(device_ids),
                    status=AlertStatus.PENDING
                )
                
                db.add(new_alert)
                db.commit()
                db.refresh(new_alert)
                
                alerts_created.append({
                    "alert_id": new_alert.id,
                    "center_lat": center_lat,
                    "center_lng": center_lng,
                    "device_count": len(cluster)
                })
                
                # Send notification to all active authorities
                await RegionDisconnectDetectorService.notify_authorities(
                    db, new_alert, len(cluster), center_lat, center_lng
                )
        
        return {
            "message": "Scan complete",
            "offline_devices_total": len(offline_devices),
            "clusters_found": len(clusters),
            "alerts_created": len(alerts_created),
            "alerts": alerts_created
        }
    
    @staticmethod
    async def notify_authorities(
        db: Session, 
        alert: 'RegionDisconnectAlert', 
        device_count: int,
        lat: float,
        lng: float
    ):
        """Send push notifications to all active authorities about the disconnect alert"""
        from ..models import Authority
        from ..services.notification_service import NotificationService
        
        # Get all active authorities with push tokens
        authorities = db.query(Authority).filter(
            and_(
                Authority.is_active == True,
                Authority.expo_push_token.isnot(None)
            )
        ).all()
        
        if not authorities:
            return
        
        tokens = [auth.expo_push_token for auth in authorities if auth.expo_push_token]
        
        if tokens:
            await NotificationService.send_push_notification(
                expo_tokens=tokens,
                title="🔴 Possible Incident Detected",
                body=f"Multiple devices ({device_count}) lost connection in region ({lat:.4f}, {lng:.4f}). Possible disaster or network failure.",
                data={
                    "type": "region_disconnect_alert",
                    "alert_id": alert.id,
                    "center_lat": lat,
                    "center_lng": lng,
                    "device_count": device_count,
                    "radius_km": RegionDisconnectDetectorService.CLUSTER_RADIUS_KM
                },
                priority="high"
            )
