from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application configuration settings"""
    
    # Database
    DATABASE_URL: str = "sqlite:///./samudar_shati.db"
    
    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    
    # Application
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = "*"
    
    # OTP
    OTP_EXPIRY_MINUTES: int = 5
    OTP_LENGTH: int = 6
    
    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 10
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 10
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS into a list"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
