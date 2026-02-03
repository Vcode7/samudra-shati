from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from .config import settings
from .models import User, Authority

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def validate_phone_number(phone_number: str) -> bool:
    """
    Validate Indian phone number format
    Accepts: +91XXXXXXXXXX or 10-digit number
    """
    # Remove spaces and dashes
    phone = phone_number.replace(" ", "").replace("-", "")
    
    # Check if starts with +91
    if phone.startswith("+91"):
        phone = phone[3:]
    elif phone.startswith("91") and len(phone) == 12:
        phone = phone[2:]
    
    # Should be 10 digits
    if len(phone) != 10 or not phone.isdigit():
        return False
    
    # Should start with 6-9
    if phone[0] not in ['6', '7', '8', '9']:
        return False
    
    return True


def normalize_phone_number(phone_number: str) -> str:
    """
    Normalize phone number to standard format: +91XXXXXXXXXX
    """
    phone = phone_number.replace(" ", "").replace("-", "")
    
    if phone.startswith("+91"):
        return phone
    elif phone.startswith("91") and len(phone) == 12:
        return "+" + phone
    else:
        return "+91" + phone
