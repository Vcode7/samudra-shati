from typing import List, Dict, Optional
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import AlertLog, AlertType


class NotificationService:
    """
    Service for sending push notifications via Expo
    """
    
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
    
    @staticmethod
    async def send_push_notification(
        expo_tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict] = None,
        sound: str = "default",
        priority: str = "high"
    ) -> Dict:
        """
        Send push notification to Expo push tokens
        
        Args:
            expo_tokens: List of Expo push tokens
            title: Notification title
            body: Notification body
            data: Additional data payload
            sound: Sound to play ('default' or None)
            priority: 'default', 'normal', or 'high'
        
        Returns:
            Response from Expo push service
        """
        if not expo_tokens:
            return {"success": False, "message": "No tokens provided"}
        
        # Filter valid Expo tokens
        valid_tokens = [
            token for token in expo_tokens 
            if token and (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken["))
        ]
        
        if not valid_tokens:
            return {"success": False, "message": "No valid Expo tokens"}
        
        # Prepare messages
        messages = []
        for token in valid_tokens:
            message = {
                "to": token,
                "sound": sound,
                "title": title,
                "body": body,
                "priority": priority,
                "channelId": "disaster-alerts",  # Android notification channel
            }
            
            if data:
                message["data"] = data
            
            messages.append(message)
        
        # Send to Expo
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    NotificationService.EXPO_PUSH_URL,
                    json=messages,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "sent_count": len(valid_tokens),
                        "expo_response": result
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Expo API returned {response.status_code}",
                        "response": response.text
                    }
        
        except Exception as e:
            print(f"Error sending push notification: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    async def send_disaster_alert(
        expo_tokens: List[str],
        disaster_id: int,
        location_name: str,
        severity: int,
        messages: Dict[str, Dict[str, str]],  # {lang: {title, body}}
        db: Session
    ) -> Dict:
        """
        Send disaster alert notification
        
        Args:
            expo_tokens: List of recipient tokens
            disaster_id: ID of disaster report
            location_name: Location of disaster
            severity: Severity level (1-10)
            messages: Multi-language messages
            db: Database session
        """
        # Use English as default
        title = messages.get("en", {}).get("title", "Disaster Alert")
        body = messages.get("en", {}).get("body", "A disaster has been reported nearby")
        
        # Send notification
        result = await NotificationService.send_push_notification(
            expo_tokens=expo_tokens,
            title=title,
            body=body,
            data={
                "type": "disaster_alert",
                "disaster_id": disaster_id,
                "severity": severity,
                "location": location_name,
                "messages": messages  # Include all language versions
            },
            sound="default",
            priority="high"
        )
        
        # Log alert
        alert_log = AlertLog(
            alert_type=AlertType.DISASTER_WARNING,
            title_en=messages.get("en", {}).get("title"),
            message_en=messages.get("en", {}).get("body"),
            title_hi=messages.get("hi", {}).get("title"),
            message_hi=messages.get("hi", {}).get("body"),
            title_ta=messages.get("ta", {}).get("title"),
            message_ta=messages.get("ta", {}).get("body"),
            disaster_report_id=disaster_id,
            recipients_count=len(expo_tokens),
            delivered_count=result.get("sent_count", 0) if result.get("success") else 0
        )
        db.add(alert_log)
        db.commit()
        
        return result
    
    @staticmethod
    async def send_verification_request(
        expo_tokens: List[str],
        disaster_id: int,
        location_name: str,
        messages: Dict[str, Dict[str, str]],
        db: Session
    ) -> Dict:
        """
        Send verification request notification
        """
        title = messages.get("en", {}).get("title", "Verification Needed")
        body = messages.get("en", {}).get("body", "Please verify a disaster report nearby")
        
        result = await NotificationService.send_push_notification(
            expo_tokens=expo_tokens,
            title=title,
            body=body,
            data={
                "type": "verification_request",
                "disaster_id": disaster_id,
                "location": location_name,
                "messages": messages
            },
            sound="default",
            priority="high"
        )
        
        # Log alert
        alert_log = AlertLog(
            alert_type=AlertType.VERIFICATION_REQUEST,
            title_en=messages.get("en", {}).get("title"),
            message_en=messages.get("en", {}).get("body"),
            title_hi=messages.get("hi", {}).get("title"),
            message_hi=messages.get("hi", {}).get("body"),
            title_ta=messages.get("ta", {}).get("title"),
            message_ta=messages.get("ta", {}).get("body"),
            disaster_report_id=disaster_id,
            recipients_count=len(expo_tokens),
            delivered_count=result.get("sent_count", 0) if result.get("success") else 0
        )
        db.add(alert_log)
        db.commit()
        
        return result
