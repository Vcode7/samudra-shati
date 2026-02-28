import random
import string
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models import OTPStore
from ..config import settings
from twilio.rest import Client

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
        otp_code = OTPService.generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

        # Invalidate old OTPs
        db.query(OTPStore).filter(
            OTPStore.phone_number == phone_number,
            OTPStore.is_used == False
        ).update({"is_used": True})

        # Save OTP
        otp_record = OTPStore(
            phone_number=phone_number,
            otp_code=otp_code,
            expires_at=expires_at
        )
        db.add(otp_record)
        db.commit()

        # if settings.DEBUG:
        #     print(f"Generated OTP: {otp_code}")
        # === REAL SMS SEND (Twilio) ===
        # if settings.DEBUG:
        #     print(f"[DEV OTP] {phone_number} -> {otp_code}")
        #     return {
        #         "success": True,
        #         "message": "OTP generated (dev mode)",
        #         "expires_in_minutes": settings.OTP_EXPIRY_MINUTES
        #     }
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        message = client.messages.create(
            to=phone_number,
            from_=settings.TWILIO_PHONE_NUMBER,
            body=f"Your Sankat Saathi OTP is {otp_code}. Valid for {settings.OTP_EXPIRY_MINUTES} minutes."
        )
        
        return {
            "success": True,
            "message": "OTP sent successfully",
            "expires_in_minutes": settings.OTP_EXPIRY_MINUTES
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
