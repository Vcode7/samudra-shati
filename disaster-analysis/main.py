"""
Disaster Analysis Service

FastAPI service for analyzing images and videos for coastal disaster events.
Uses 3-Model CNN Pipeline: Binary → Type → Severity
"""
import time
import io
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

from config import HOST, PORT, VIDEO_FRAME_STRIDE, MAX_FRAMES
from analyzers import CNNAnalyzer, PipelineResult
from processors import FrameExtractor
from utils import PredictionLogger


# Initialize FastAPI app
app = FastAPI(
    title="Disaster Analysis Service",
    description="AI-powered image/video analysis for coastal disaster detection (3-Model CNN Pipeline)",
    version="2.0.0",
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
_analyzer: Optional[CNNAnalyzer] = None
_frame_extractor: Optional[FrameExtractor] = None
_logger: Optional[PredictionLogger] = None


def get_analyzer() -> CNNAnalyzer:
    """Get or create CNN analyzer"""
    global _analyzer
    if _analyzer is None:
        _analyzer = CNNAnalyzer()
    return _analyzer


def get_frame_extractor() -> FrameExtractor:
    """Get or create frame extractor"""
    global _frame_extractor
    if _frame_extractor is None:
        _frame_extractor = FrameExtractor(frame_stride=VIDEO_FRAME_STRIDE, max_frames=MAX_FRAMES)
    return _frame_extractor


def get_logger() -> PredictionLogger:
    """Get or create prediction logger"""
    global _logger
    if _logger is None:
        _logger = PredictionLogger()
    return _logger


# =============================================================================
# Response Models
# =============================================================================

class BinaryResult(BaseModel):
    label: str
    confidence: float


class TypeResult(BaseModel):
    label: Optional[str]
    confidence: Optional[float]


class SeverityResult(BaseModel):
    label: Optional[str]
    confidence: Optional[float]


class AnalysisResponse(BaseModel):
    """Response from disaster analysis (new format)"""
    is_disaster: bool
    binary: BinaryResult
    type: TypeResult
    severity: SeverityResult
    frames_analyzed: int = 0
    processing_time_ms: float


class LegacyAnalysisResponse(BaseModel):
    """Legacy response format for backward compatibility"""
    is_disaster: bool
    type: str
    severity: str  # LOW, MEDIUM, HIGH
    confidence: float
    explanation: str
    frames_analyzed: int = 0
    processing_time_ms: float


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_name: str
    pipeline: str


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        analyzer = get_analyzer()
        return HealthResponse(
            status="healthy",
            model_loaded=analyzer.is_loaded,
            model_name=analyzer.model_name,
            pipeline="binary → type → severity"
        )
    except Exception as e:
        return HealthResponse(
            status="error",
            model_loaded=False,
            model_name=str(e),
            pipeline="failed"
        )


@app.post("/analyze/image", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze a single image for disaster content.
    
    Pipeline:
    1. Binary: Is this a disaster? (disaster / not_disaster)
    2. Type: What kind? (flood / cyclone / fire / earthquake / other)
    3. Severity: How severe? (low / medium / high)
    
    If binary = not_disaster, type and severity are null.
    """
    start_time = time.time()
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image (JPG, PNG, WebP)")
    
    try:
        # Read and convert image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Analyze with pipeline
        analyzer = get_analyzer()
        result = analyzer.analyze_pipeline(image)
        
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
            binary=BinaryResult(**result.binary),
            type=TypeResult(**result.type),
            severity=SeverityResult(**result.severity),
            frames_analyzed=1,
            processing_time_ms=round(processing_time, 2)
        )
        
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")


@app.post("/analyze/video", response_model=AnalysisResponse)
async def analyze_video(file: UploadFile = File(...)):
    """
    Analyze a video for disaster content.
    
    Extracts frames with stride=30, analyzes aggregated with LSTM.
    """
    start_time = time.time()
    
    # Validate file type
    valid_types = ["video/mp4", "video/avi", "video/quicktime", "video/x-msvideo"]
    if not file.content_type or file.content_type not in valid_types:
        raise HTTPException(400, "File must be a video (MP4, AVI, MOV)")
    
    try:
        # Read video
        contents = await file.read()
        
        # Extract frames with stride
        extractor = get_frame_extractor()
        frames = extractor.extract_from_bytes(contents)
        
        if not frames:
            raise HTTPException(400, "Could not extract frames from video")
        
        # Analyze with pipeline (uses LSTM temporal aggregation)
        analyzer = get_analyzer()
        result = analyzer.analyze_pipeline_video(frames)
        
        # Calculate processing time
        processing_time = (time.time() - start_time) * 1000
        
        # Log prediction
        get_logger().log_prediction(
            media_type="video",
            result=result.to_dict(),
            filename=file.filename,
            processing_time_ms=processing_time,
            frames_analyzed=len(frames)
        )
        
        return AnalysisResponse(
            is_disaster=result.is_disaster,
            binary=BinaryResult(**result.binary),
            type=TypeResult(**result.type),
            severity=SeverityResult(**result.severity),
            frames_analyzed=len(frames),
            processing_time_ms=round(processing_time, 2)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Video analysis failed: {str(e)}")


@app.post("/analyze/legacy", response_model=LegacyAnalysisResponse)
async def analyze_image_legacy(file: UploadFile = File(...)):
    """
    Legacy endpoint for backward compatibility.
    
    Returns old-style response format.
    """
    start_time = time.time()
    
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        analyzer = get_analyzer()
        result = analyzer.analyze(image)  # Uses legacy analyze method
        
        processing_time = (time.time() - start_time) * 1000
        
        return LegacyAnalysisResponse(
            is_disaster=result.is_disaster,
            type=result.type,
            severity=result.severity,
            confidence=result.confidence,
            explanation=result.explanation,
            frames_analyzed=1,
            processing_time_ms=round(processing_time, 2)
        )
        
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {str(e)}")


@app.get("/logs/recent")
async def get_recent_logs(limit: int = 50):
    """Get recent prediction logs"""
    logger = get_logger()
    return logger.get_recent_predictions(limit)


# =============================================================================
# Startup Event
# =============================================================================

@app.on_event("startup")
async def startup():
    """Pre-load models on startup"""
    print("[Startup] Loading 3-Model CNN Pipeline...")
    print("[Startup] Models: Binary → Type → Severity")
    get_analyzer()
    print("[Startup] Ready to analyze!")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
