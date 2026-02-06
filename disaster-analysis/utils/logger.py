"""
Prediction Logger

Logs all predictions for monitoring and debugging.
"""
import os
import json
from datetime import datetime
from typing import Optional
from config import LOG_DIR, LOG_PREDICTIONS


class PredictionLogger:
    """
    Logs disaster predictions to file for monitoring.
    """
    
    def __init__(self, log_dir: str = LOG_DIR):
        self.log_dir = log_dir
        self.enabled = LOG_PREDICTIONS
        
        if self.enabled:
            os.makedirs(log_dir, exist_ok=True)
    
    def log_prediction(
        self,
        media_type: str,  # "image" or "video"
        result: dict,
        filename: Optional[str] = None,
        processing_time_ms: float = 0,
        frames_analyzed: int = 0,
    ):
        """
        Log a prediction result.
        
        Args:
            media_type: Type of media analyzed
            result: Prediction result dict
            filename: Original filename (optional)
            processing_time_ms: Time taken to process
            frames_analyzed: Number of frames (for video)
        """
        if not self.enabled:
            return
        
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "media_type": media_type,
            "filename": filename,
            "is_disaster": result.get("is_disaster", False),
            "type": result.get("type", "unknown"),
            "severity": result.get("severity", "LOW"),
            "confidence": result.get("confidence", 0),
            "processing_time_ms": processing_time_ms,
            "frames_analyzed": frames_analyzed,
        }
        
        # Write to daily log file
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        log_file = os.path.join(self.log_dir, f"predictions_{date_str}.jsonl")
        
        with open(log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
        
        # Print summary
        emoji = "🚨" if result.get("is_disaster") else "✅"
        print(f"[Logger] {emoji} {media_type}: {result.get('type')} ({result.get('confidence', 0):.2f})")
    
    def get_recent_predictions(self, limit: int = 100) -> list:
        """
        Get recent predictions from logs.
        
        Args:
            limit: Maximum number of predictions to return
        
        Returns:
            List of prediction dicts
        """
        predictions = []
        
        # Get all log files
        if not os.path.exists(self.log_dir):
            return predictions
        
        log_files = sorted(
            [f for f in os.listdir(self.log_dir) if f.startswith("predictions_")],
            reverse=True
        )
        
        for log_file in log_files:
            if len(predictions) >= limit:
                break
            
            file_path = os.path.join(self.log_dir, log_file)
            with open(file_path, "r") as f:
                for line in f:
                    if line.strip():
                        predictions.append(json.loads(line))
                        if len(predictions) >= limit:
                            break
        
        return predictions[:limit]
