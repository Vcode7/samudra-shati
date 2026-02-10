from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import json

from ..database import get_db
from ..models import EarlyWarningPrediction, PredictionStatus, User, Authority, DisasterAlertStatus
from ..schemas import EarlyWarningCreate, EarlyWarningResponse, EarlyWarningVerify
from ..dependencies import get_current_authority
from ..services.notification_service import NotificationService
from ..services.alert_service import AlertService


router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.post("/early-warning", status_code=status.HTTP_201_CREATED)
async def create_early_warning(
    prediction: EarlyWarningCreate,
    db: Session = Depends(get_db)
):
    """
    Receive early warning prediction from disaster-prediction-service
    
    This endpoint:
    1. Stores the prediction in the database
    2. Sends notifications to nearby users
    3. Notifies relevant authorities
    4. Does NOT activate emergency mode (authority verification required)
    """
    try:
        # Parse predicted_at timestamp
        predicted_at = datetime.fromisoformat(prediction.predicted_at.replace('Z', '+00:00'))
        
        # Create prediction record
        new_prediction = EarlyWarningPrediction(
            type=prediction.type,
            latitude=prediction.latitude,
            longitude=prediction.longitude,
            severity=prediction.severity,
            confidence=prediction.confidence,
            source_apis=json.dumps(prediction.source),
            message=prediction.message,
            predicted_at=predicted_at,
            valid_for_minutes=prediction.valid_for_minutes,
            status=PredictionStatus.PENDING
        )
        
        db.add(new_prediction)
        db.commit()
        db.refresh(new_prediction)
        
        print(f"\n[EARLY WARNING] Received prediction: {prediction.type} (severity {prediction.severity}, confidence {prediction.confidence})")
        
        # Send notifications to users in affected area
        # Use a larger radius for early warnings to reach more people
        radius_km = 50.0  # 50km radius for early warnings
        
        nearby_users = AlertService.get_nearby_users(
            latitude=prediction.latitude,
            longitude=prediction.longitude,
            radius_km=radius_km,
            db=db
        )
        
        if nearby_users:
            # Prepare multi-language messages
            messages = AlertService.prepare_multilingual_message(
                template_key="ai_early_warning",
                location=f"{prediction.latitude:.2f}, {prediction.longitude:.2f}",
                severity=prediction.severity
            )
            
            # Override with actual prediction message for English
            messages["en"] = {
                "title": f"⚠️ AI Early Warning: {prediction.type.replace('_', ' ').title()}",
                "body": f"{prediction.message} (Confidence: {int(prediction.confidence * 100)}%)"
            }
            
            # Send push notifications
            expo_tokens = [user.expo_push_token for user in nearby_users if user.expo_push_token]
            
            if expo_tokens:
                await NotificationService.send_push_notification(
                    expo_tokens=expo_tokens,
                    title=messages["en"]["title"],
                    body=messages["en"]["body"],
                    data={
                        "type": "ai_early_warning",
                        "prediction_id": new_prediction.id,
                        "prediction_type": prediction.type,
                        "severity": prediction.severity,
                        "confidence": prediction.confidence,
                        "latitude": prediction.latitude,
                        "longitude": prediction.longitude,
                        "messages": messages
                    },
                    sound="default",
                    priority="high"
                )
                
                print(f"  ✓ Sent early warning to {len(expo_tokens)} users")
        
        # Notify relevant authorities
        authorities = AlertService.get_relevant_authorities(
            latitude=prediction.latitude,
            longitude=prediction.longitude,
            db=db
        )
        
        if authorities:
            authority_tokens = [auth.expo_push_token for auth in authorities if auth.expo_push_token]
            
            if authority_tokens:
                await NotificationService.send_push_notification(
                    expo_tokens=authority_tokens,
                    title=f"🤖 AI Prediction: {prediction.type.replace('_', ' ').title()}",
                    body=f"{prediction.message} | Verify or cancel this prediction.",
                    data={
                        "type": "ai_prediction_for_authority",
                        "prediction_id": new_prediction.id,
                        "prediction_type": prediction.type,
                        "severity": prediction.severity,
                        "confidence": prediction.confidence,
                        "latitude": prediction.latitude,
                        "longitude": prediction.longitude
                    },
                    sound="default",
                    priority="high"
                )
                
                print(f"  ✓ Notified {len(authority_tokens)} authorities")
        
        return {
            "success": True,
            "prediction_id": new_prediction.id,
            "message": "Early warning stored and notifications sent",
            "users_notified": len(expo_tokens) if nearby_users else 0,
            "authorities_notified": len(authority_tokens) if authorities else 0
        }
    
    except Exception as e:
        db.rollback()
        print(f"Error creating early warning: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create early warning: {str(e)}"
        )


@router.get("/active", response_model=List[EarlyWarningResponse])
async def get_active_predictions(db: Session = Depends(get_db)):
    """
    Get all active (non-expired, pending) predictions
    
    Returns predictions that are:
    - Status: PENDING
    - Not expired (created_at + valid_for_minutes > now)
    """
    now = datetime.utcnow()
    
    predictions = db.query(EarlyWarningPrediction).filter(
        EarlyWarningPrediction.status == PredictionStatus.PENDING
    ).all()
    
    # Filter out expired predictions
    active_predictions = []
    for pred in predictions:
        expiry_time = pred.predicted_at + timedelta(minutes=pred.valid_for_minutes)
        if expiry_time > now:
            active_predictions.append(pred)
        else:
            # Mark as expired
            pred.status = PredictionStatus.EXPIRED
            db.commit()
    
    return active_predictions


@router.post("/{prediction_id}/verify")
async def verify_prediction(
    prediction_id: int,
    verify_data: EarlyWarningVerify,
    current_authority: Authority = Depends(get_current_authority),
    db: Session = Depends(get_db)
):
    """
    Authority verifies or cancels an AI prediction
    
    Actions:
    - "verify": Mark as verified and activate emergency mode
    - "cancel": Mark as cancelled (false prediction)
    """
    prediction = db.query(EarlyWarningPrediction).filter(
        EarlyWarningPrediction.id == prediction_id
    ).first()
    
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found"
        )
    
    if prediction.status != PredictionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Prediction already {prediction.status}"
        )
    
    if verify_data.action == "verify":
        # Mark as verified
        prediction.status = PredictionStatus.VERIFIED
        prediction.verified_by_authority_id = current_authority.id
        db.commit()
        
        # Send EMERGENCY_ACTIVE notification to all nearby users
        nearby_users = AlertService.get_nearby_users(
            latitude=prediction.latitude,
            longitude=prediction.longitude,
            radius_km=50.0,
            db=db
        )
        
        expo_tokens = [user.expo_push_token for user in nearby_users if user.expo_push_token]
        
        if expo_tokens:
            messages = AlertService.prepare_multilingual_message(
                template_key="emergency_active",
                location=f"{prediction.latitude:.2f}, {prediction.longitude:.2f}",
                severity=prediction.severity
            )
            
            messages["en"]["body"] = f"🚨 EMERGENCY VERIFIED: {prediction.message}"
            
            await NotificationService.send_push_notification(
                expo_tokens=expo_tokens,
                title="🚨 EMERGENCY ALERT",
                body=messages["en"]["body"],
                data={
                    "type": "emergency_active",
                    "prediction_id": prediction.id,
                    "prediction_type": prediction.type,
                    "severity": prediction.severity,
                    "latitude": prediction.latitude,
                    "longitude": prediction.longitude,
                    "messages": messages
                },
                sound="default",
                priority="high"
            )
        
        return {
            "success": True,
            "message": "Prediction verified and emergency activated",
            "prediction_id": prediction.id,
            "status": "verified",
            "emergency_notifications_sent": len(expo_tokens) if expo_tokens else 0
        }
    
    elif verify_data.action == "cancel":
        # Mark as cancelled
        prediction.status = PredictionStatus.CANCELLED
        prediction.verified_by_authority_id = current_authority.id
        db.commit()
        
        return {
            "success": True,
            "message": "Prediction cancelled",
            "prediction_id": prediction.id,
            "status": "cancelled"
        }
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Must be 'verify' or 'cancel'"
        )


@router.get("/{prediction_id}", response_model=EarlyWarningResponse)
async def get_prediction(prediction_id: int, db: Session = Depends(get_db)):
    """Get a specific prediction by ID"""
    prediction = db.query(EarlyWarningPrediction).filter(
        EarlyWarningPrediction.id == prediction_id
    ).first()
    
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found"
        )
    
    return prediction
