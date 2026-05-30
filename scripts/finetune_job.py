import os
import numpy as np
import cv2
from deepface import DeepFace
from supabase import create_client, Client

def normalize_vector(vector):
    norm = np.linalg.norm(vector)
    if norm == 0:
        return vector
    return vector / norm

def run_finetuning():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return
        
    supabase: Client = create_client(url, key)
    print("Connected to Supabase. Starting Fine-Tuning Job...")
    
    bucket = "dataset"
    try:
        files_response = supabase.storage.from_(bucket).list()
    except Exception as e:
        print(f"Error accessing dataset bucket: {e}")
        return

    if not files_response:
        print("No folders found in dataset bucket.")
        return
        
    for folder in files_response:
        user_id = folder.get("name")
        if not user_id or not user_id.isdigit():
            continue
            
        print(f"\nProcessing User ID: {user_id}")
        try:
            user_files = supabase.storage.from_(bucket).list(user_id)
        except Exception as e:
            print(f"Failed to list files for user {user_id}: {e}")
            continue
            
        embeddings = []
        for f in user_files:
            file_name = f.get('name')
            if not file_name or not file_name.endswith('.jpg'): 
                continue
                
            file_path = f"{user_id}/{file_name}"
            try:
                res = supabase.storage.from_(bucket).download(file_path)
            except Exception as e:
                print(f"Failed to download {file_path}: {e}")
                continue
            
            # Decode image from bytes
            nparr = np.frombuffer(res, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                print(f"  - Failed to decode {file_name}")
                continue
                
            # Extract embedding using DeepFace Facenet512 (matches backend)
            try:
                embedding_objs = DeepFace.represent(
                    img_path=img,
                    model_name="Facenet512",
                    enforce_detection=False,
                    detector_backend="skip",
                    align=False
                )
                if embedding_objs:
                    embedding = np.array(embedding_objs[0]["embedding"], dtype="float32")
                    embeddings.append(embedding)
                    print(f"  - Extracted face from {file_name}")
                else:
                    print(f"  - No face found in {file_name}")
            except Exception as e:
                print(f"  - Error extracting face from {file_name}: {e}")
                
        if embeddings:
            # Compute average embedding for robustness
            avg_embedding = np.mean(embeddings, axis=0)
            avg_embedding = normalize_vector(avg_embedding)
            
            # Update database record
            response = supabase.table("face_profiles").update({"embedding": avg_embedding.tolist()}).eq("user_id", int(user_id)).execute()
            
            if response.data:
                print(f"✅ Successfully updated embedding for user {user_id} in database.")
                
                # Cleanup: Optional - remove processed images from bucket after success to save space
                # for f in user_files:
                #     if f.get('name').endswith('.jpg'):
                #         supabase.storage.from_(bucket).remove([f"{user_id}/{f['name']}"])
            else:
                print(f"❌ Failed to update embedding for user {user_id}.")
        else:
            print(f"⚠️ No embeddings extracted for user {user_id}.")

if __name__ == "__main__":
    run_finetuning()
