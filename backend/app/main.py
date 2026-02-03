from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

from .config import settings
from .database import init_db
from .routes import users, authorities, disasters

# Create FastAPI app
app = FastAPI(
    title="Samudar Shati API",
    description="Disaster Alert and Reporting System for Coastal Areas",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(users.router)
app.include_router(authorities.router)
app.include_router(disasters.router)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    print("Initializing database...")
    init_db()
    print("Database initialized successfully!")
    print(f"API running in {'DEBUG' if settings.DEBUG else 'PRODUCTION'} mode")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Samudar Shati API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": "2026-02-02T21:42:38+05:30"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    if settings.DEBUG:
        # In debug mode, return detailed error
        import traceback
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(exc),
                "traceback": traceback.format_exc()
            }
        )
    else:
        # In production, return generic error
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
