from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import json

from ..database import get_db
from ..models import Device, ExternalDisasterReport, ExternalDisasterSource, AlertLog, AlertType
from ..schemas import (
    TestBroadcastResponse, ExternalAlertCreate, ExternalAlertResponse
)
from ..services.notification_service import NotificationService
from ..services.alert_service import AlertService

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/test-broadcast", response_model=TestBroadcastResponse)
async def test_broadcast_alert(
    db: Session = Depends(get_db)
):
    """
    Send a test alert to ALL registered devices.
    
    Used to verify push notification delivery across all devices.
    Logs the total, delivered, and failed counts.
    """
    # Get all active device tokens
    devices = db.query(Device).filter(
        Device.is_active == True,
        Device.expo_push_token.isnot(None)
    ).all()
    
    tokens = [d.expo_push_token for d in devices]
    
    if not tokens:
        return TestBroadcastResponse(
            success=False,
            total_tokens=0,
            delivered_count=0,
            failed_count=0,
            message="No registered devices found"
        )
    
    # Send test notification
    result = await NotificationService.send_push_notification(
        expo_tokens=tokens,
        title="🔔 Test Alert",
        body="This is a system-wide test alert. If you received this, notifications are working.",
        data={
            "type": "test_broadcast",
            "timestamp": datetime.utcnow().isoformat()
        },
        priority="high"
    )
    
    sent_count = result.get("sent_count", 0) if result.get("success") else 0
    
    # Log the broadcast
    alert_log = AlertLog(
        alert_type=AlertType.DISASTER_WARNING,
        title_en="🔔 Test Alert",
        message_en="This is a system-wide test alert.",
        title_hi="🔔 परीक्षण अलर्ट",
        message_hi="यह एक सिस्टम-व्यापी परीक्षण अलर्ट है।",
        title_ta="🔔 சோதனை எச்சரிக்கை",
        message_ta="இது ஒரு கணினி அளவிலான சோதனை எச்சரிக்கை.",
        recipients_count=len(tokens),
        delivered_count=sent_count
    )
    db.add(alert_log)
    db.commit()
    
    return TestBroadcastResponse(
        success=result.get("success", False),
        total_tokens=len(tokens),
        delivered_count=sent_count,
        failed_count=len(tokens) - sent_count,
        message="Test broadcast completed"
    )


@router.post("/external-alerts", response_model=ExternalAlertResponse)
async def submit_external_alert(
    alert_data: ExternalAlertCreate,
    db: Session = Depends(get_db)
):
    """
    Receive external alert from social media crawler.
    
    This endpoint is intended for the social-crawler service.
    No authentication required (internal service communication).
    
    If confidence_score > 0.7, triggers push notification to all devices.
    """
    # Create external report
    external_report = ExternalDisasterReport(
        source=ExternalDisasterSource(alert_data.source.value),
        source_id=alert_data.source_id,
        source_url=alert_data.source_url,
        text_content=alert_data.text_content,
        media_url=alert_data.media_url,
        location_text=alert_data.location_text,
        latitude=alert_data.latitude,
        longitude=alert_data.longitude,
        confidence_score=alert_data.confidence_score,
        keywords_matched=json.dumps(alert_data.keywords_matched) if alert_data.keywords_matched else None,
        is_processed=False,
        is_valid=True
    )
    db.add(external_report)
    db.commit()
    db.refresh(external_report)
    
    # Trigger push notification if confidence is high enough
    if alert_data.confidence_score >= 0.7:
        # Get all device tokens
        devices = db.query(Device).filter(
            Device.is_active == True,
            Device.expo_push_token.isnot(None)
        ).all()
        
        tokens = [d.expo_push_token for d in devices]
        
        if tokens:
            location = alert_data.location_text or "unknown location"
            
            # Prepare multilingual messages
            messages = {
                "en": {
                    "title": "🌐 External Alert Detected",
                    "body": f"Potential disaster reported near {location}. Source: {alert_data.source.value}"
                },
                "hi": {
                    "title": "🌐 बाहरी अलर्ट",
                    "body": f"{location} के पास संभावित आपदा की सूचना। स्रोत: {alert_data.source.value}"
                },
                "ta": {
                    "title": "🌐 வெளி எச்சரிக்கை",
                    "body": f"{location} அருகில் சாத்தியமான பேரிடர் தெரிவிக்கப்பட்டுள்ளது."
                }
            }
            
            await NotificationService.send_push_notification(
                expo_tokens=tokens,
                title=messages["en"]["title"],
                body=messages["en"]["body"],
                data={
                    "type": "external_alert",
                    "id": external_report.id,
                    "source": alert_data.source.value,
                    "messages": messages
                },
                priority="high"
            )
        
        # Mark as processed
        external_report.is_processed = True
        db.commit()
    
    return external_report


@router.get("/external-alerts", response_model=List[ExternalAlertResponse])
async def get_external_alerts(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get list of external alerts from social crawler.
    """
    alerts = db.query(ExternalDisasterReport).order_by(
        ExternalDisasterReport.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return alerts


@router.get("/notification-logs")
async def get_notification_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get recent notification logs for monitoring.
    """
    logs = db.query(AlertLog).order_by(
        AlertLog.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return [
        {
            "id": log.id,
            "alert_type": log.alert_type.value if log.alert_type else None,
            "title": log.title_en,
            "recipients_count": log.recipients_count,
            "delivered_count": log.delivered_count,
            "created_at": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]
