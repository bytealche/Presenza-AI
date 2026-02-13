import os
import requests
from pathlib import Path

HOME = str(Path.home())
WEIGHTS_DIR = os.path.join(HOME, ".deepface", "weights")
WEIGHTS_FILE = os.path.join(WEIGHTS_DIR, "vgg_face_weights.h5")
URL = "https://github.com/serengil/deepface_models/releases/download/v1.0/vgg_face_weights.h5"

os.makedirs(WEIGHTS_DIR, exist_ok=True)

if os.path.exists(WEIGHTS_FILE):
    print(f"File already exists at {WEIGHTS_FILE}")
else:
    print(f"Downloading {URL} to {WEIGHTS_FILE}...")
    try:
        response = requests.get(URL, stream=True)
        response.raise_for_status()
        with open(WEIGHTS_FILE, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print("Download complete.")
    except Exception as e:
        print(f"Download failed: {e}")
