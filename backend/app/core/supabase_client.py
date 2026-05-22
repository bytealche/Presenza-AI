import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger(__name__)

url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_SERVICE_KEY", "")

supabase: Client | None = None

if url and key:
    try:
        supabase = create_client(url, key)
        logger.info("Supabase client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
else:
    logger.warning("SUPABASE_URL or SUPABASE_SERVICE_KEY not found in environment variables. Supabase features will be disabled.")


import asyncio

async def upload_face_to_dataset(user_id: int, face_image):
    """
    Compresses a face frame to JPEG and uploads it to the Supabase "dataset" bucket.
    """
    if supabase is None:
        return
        
    try:
        import cv2
        from datetime import datetime
        
        # Compress face to lightweight jpeg memory buffer (85% quality)
        success, buffer = cv2.imencode('.jpg', face_image, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not success:
            logger.error(f"Failed to compress face image to JPEG for user {user_id}.")
            return
            
        file_bytes = buffer.tobytes()
        
        # Structure: dataset/1/img_2026xxxx.jpg
        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
        file_path = f"{user_id}/img_{timestamp}.jpg"
        
        # Run synchronous supabase upload in a background thread
        def _upload():
            supabase.storage.from_("dataset").upload(
                file=file_bytes,
                path=file_path,
                file_options={"content-type": "image/jpeg"}
            )
            
        await asyncio.to_thread(_upload)
        logger.info(f"Successfully uploaded dataset face for user {user_id}")
        
    except Exception as e:
        logger.error(f"Error uploading face dataset to Supabase: {e}")
