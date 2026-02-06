"""
Video Frame Extractor

Extracts frames from video at specified intervals for analysis.
"""
import os
import tempfile
from typing import List, Optional
from PIL import Image
import cv2

from config import VIDEO_FPS, MAX_FRAMES


class FrameExtractor:
    """
    Extracts frames from video files for disaster analysis.
    """
    
    def __init__(self, fps: int = VIDEO_FPS, max_frames: int = MAX_FRAMES):
        """
        Initialize frame extractor.
        
        Args:
            fps: Frames per second to extract (default 1)
            max_frames: Maximum frames to extract (default 30)
        """
        self.fps = fps
        self.max_frames = max_frames
    
    def extract_from_file(self, video_path: str) -> List[Image.Image]:
        """
        Extract frames from a video file.
        
        Args:
            video_path: Path to video file
        
        Returns:
            List of PIL Images
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")
        
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
        
        try:
            return self._extract_frames(cap)
        finally:
            cap.release()
    
    def extract_from_bytes(self, video_bytes: bytes) -> List[Image.Image]:
        """
        Extract frames from video bytes (e.g., from upload).
        
        Args:
            video_bytes: Raw video bytes
        
        Returns:
            List of PIL Images
        """
        # Write to temp file (OpenCV requires file path)
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(video_bytes)
            temp_path = f.name
        
        try:
            return self.extract_from_file(temp_path)
        finally:
            # Clean up temp file
            os.unlink(temp_path)
    
    def _extract_frames(self, cap: cv2.VideoCapture) -> List[Image.Image]:
        """
        Internal method to extract frames from VideoCapture.
        """
        frames: List[Image.Image] = []
        
        # Get video properties
        video_fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / video_fps if video_fps > 0 else 0
        
        print(f"[FrameExtractor] Video: {duration:.1f}s, {total_frames} frames, {video_fps:.1f} FPS")
        
        # Calculate frame interval
        frame_interval = int(video_fps / self.fps) if video_fps > 0 else 1
        frame_interval = max(1, frame_interval)
        
        frame_idx = 0
        extracted = 0
        
        while cap.isOpened() and extracted < self.max_frames:
            ret, frame = cap.read()
            
            if not ret:
                break
            
            # Extract at interval
            if frame_idx % frame_interval == 0:
                # Convert BGR to RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                frames.append(pil_image)
                extracted += 1
            
            frame_idx += 1
        
        print(f"[FrameExtractor] Extracted {len(frames)} frames")
        return frames
    
    def get_video_info(self, video_path: str) -> dict:
        """
        Get video metadata.
        
        Args:
            video_path: Path to video
        
        Returns:
            Dict with video info
        """
        cap = cv2.VideoCapture(video_path)
        
        try:
            return {
                "fps": cap.get(cv2.CAP_PROP_FPS),
                "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                "duration_seconds": cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
                    if cap.get(cv2.CAP_PROP_FPS) > 0 else 0
            }
        finally:
            cap.release()
