import random
import string
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models import OTPStore
from ..config import settings


class OTPService:
    """
    Mock OTP service for phone number verification
    
    TODO: Replace with real SMS provider integration (Twilio, MSG91, etc.)
    """
    
    @staticmethod
    def generate_otp(length: int = None) -> str:
        """Generate a random OTP code"""
        if length is None:
            length = settings.OTP_LENGTH
        
        return ''.join(random.choices(string.digits, k=length))
    
    @staticmethod
    def send_otp(phone_number: str, db: Session) -> dict:
        """
        Generate and 'send' OTP to phone number
        
        In production, this would call an SMS API
        For now, we just store it and log it
        """
        # Generate OTP
        otp_code = OTPService.generate_otp()
        print(f"Generated OTP: {otp_code}")
        # Calculate expiry
        expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        
        # Invalidate any existing OTPs for this number
        db.query(OTPStore).filter(
            OTPStore.phone_number == phone_number,
            OTPStore.is_used == False
        ).update({"is_used": True})
        
        # Store new OTP
        otp_record = OTPStore(
            phone_number=phone_number,
            otp_code=otp_code,
            expires_at=expires_at
        )
        db.add(otp_record)
        db.commit()
        
        # TODO: Send actual SMS here
        # Example: twilio_client.messages.create(to=phone_number, body=f"Your OTP is: {otp_code}")
        
        # For development, log to console
        print(f"\n{'='*50}")
        print(f"📱 MOCK SMS SERVICE")
        print(f"{'='*50}")
        print(f"To: {phone_number}")
        print(f"OTP: {otp_code}")
        print(f"Expires: {expires_at.strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"{'='*50}\n")
        
        return {
            "success": True,
            "message": "OTP sent successfully",
            "expires_in_minutes": settings.OTP_EXPIRY_MINUTES,
            # In production, don't return OTP in response
            "otp_code": otp_code if settings.DEBUG else None
        }
    
    @staticmethod
    def verify_otp(phone_number: str, otp_code: str, db: Session) -> bool:
        """
        Verify OTP code for a phone number
        """
        # Find valid OTP
        otp_record = db.query(OTPStore).filter(
            OTPStore.phone_number == phone_number,
            OTPStore.otp_code == otp_code,
            OTPStore.is_used == False,
            OTPStore.expires_at > datetime.utcnow()
        ).first()
        
        if not otp_record:
            return False
        
        # Mark as used
        otp_record.is_used = True
        db.commit()
        
        return True
    
    @staticmethod
    def cleanup_expired_otps(db: Session):
        """
        Clean up expired OTPs from database
        Should be run periodically
        """
        db.query(OTPStore).filter(
            OTPStore.expires_at < datetime.utcnow()
        ).delete()
        db.commit()
