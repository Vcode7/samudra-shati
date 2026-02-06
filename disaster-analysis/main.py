"""
Disaster Analysis Service

FastAPI service for analyzing images and videos for coastal disaster events.
Uses CLIP zero-shot classification with modular architecture.
"""
import time
import io
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from config import HOST, PORT
from analyzers import CLIPAnalyzer
from processors import FrameExtractor, aggregate_predictions
from utils import PredictionLogger


# Initialize FastAPI app
app = FastAPI(
    title="Disaster Analysis Service",
    description="AI-powered image/video analysis for coastal disaster detection",
    version="1.0.0",
    docs_url="/docs",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances (lazy loaded)
_analyzer: Optional[CLIPAnalyzer] = None
_frame_extractor: Optional[FrameExtractor] = None
_logger: Optional[PredictionLogger] = None


def get_analyzer() -> CLIPAnalyzer:
    """Get or create CLIP analyzer"""
    global _analyzer
    if _analyzer is None:
        _analyzer = CLIPAnalyzer()
    return _analyzer


def get_frame_extractor() -> FrameExtractor:
    """Get or create frame extractor"""
    global _frame_extractor
    if _frame_extractor is None:
        _frame_extractor = FrameExtractor()
    return _frame_extractor


def get_logger() -> PredictionLogger:
    """Get or create prediction logger"""
    global _logger
    if _logger is None:
        _logger = PredictionLogger()
    return _logger


# Response models
class AnalysisResponse(BaseModel):
    """Response from disaster analysis"""
    is_disaster: bool
    type: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    confidence: float
    explanation: str
    frames_analyzed: int = 0
    processing_time_ms: float


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_name: str


# Endpoints
@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        analyzer = get_analyzer()
        return HealthResponse(
            status="healthy",
            model_loaded=analyzer.is_loaded,
            model_name=analyzer.model_name
        )
    except Exception as e:
        return HealthResponse(
            status="error",
            model_loaded=False,
            model_name=str(e)
        )


@app.post("/analyze/image", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze a single image for disaster content.
    
    Accepts: JPG, PNG, WebP images
    Returns: Disaster classification with severity
    """
    start_time = time.time()
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image (JPG, PNG, WebP)")
    
    try:
        # Read and convert image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Analyze
        analyzer = get_analyzer()
        result = analyzer.analyze(image)
        
        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000
        
        # Log prediction
        get_logger().log_prediction(
            media_type="image",
            result=result.to_dict(),
            filename=file.filename,
            processing_time_ms=processing_time
        )
        
        return AnalysisResponse(
            is_disaster=result.is_disaster,
            type=result.type,
            severity=result.severity,
            confidence=result.confidence,
            explanation=result.explanation,
            frames_analyzed=0,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")


@app.post("/analyze/video", response_model=AnalysisResponse)
async def analyze_video(file: UploadFile = File(...)):
    """
    Analyze a video for disaster content.
    
    Extracts frames at 1 FPS, analyzes each, and aggregates results.
    Accepts: MP4, AVI, MOV videos
    Returns: Aggregated disaster classification
    """
    start_time = time.time()
    
    # Validate file type
    valid_types = ["video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"]
    if not file.content_type or file.content_type not in valid_types:
        raise HTTPException(400, "File must be a video (MP4, AVI, MOV)")
    
    try:
        # Read video
        contents = await file.read()
        
        # Extract frames
        extractor = get_frame_extractor()
        frames = extractor.extract_from_bytes(contents)
        
        if not frames:
            raise HTTPException(400, "Could not extract frames from video")
        
        # Analyze frames
        analyzer = get_analyzer()
        frame_results = analyzer.analyze_batch(frames)
        
        # Aggregate results
        final_result = aggregate_predictions(frame_results)
        
        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000
        
        # Log prediction
        get_logger().log_prediction(
            media_type="video",
            result=final_result.to_dict(),
            filename=file.filename,
            processing_time_ms=processing_time,
            frames_analyzed=len(frames)
        )
        
        return AnalysisResponse(
            is_disaster=final_result.is_disaster,
            type=final_result.type,
            severity=final_result.severity,
            confidence=final_result.confidence,
            explanation=final_result.explanation,
            frames_analyzed=len(frames),
            processing_time_ms=processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Video analysis failed: {str(e)}")


@app.get("/logs/recent")
async def get_recent_logs(limit: int = 50):
    """Get recent prediction logs"""
    logger = get_logger()
    return logger.get_recent_predictions(limit)


# Startup event
@app.on_event("startup")
async def startup():
    """Pre-load model on startup"""
    print("[Startup] Loading CLIP model...")
    get_analyzer()
    print("[Startup] Ready to analyze!")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
