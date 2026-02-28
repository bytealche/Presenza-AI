import requests
import os

url = "https://github.com/serengil/deepface_models/releases/download/v1.0/arcface_weights.h5"
output_path = r"C:\Users\Aniket\.deepface\weights\arcface_weights.h5"

os.makedirs(os.path.dirname(output_path), exist_ok=True)

print(f"Downloading {url} to {output_path}...")
try:
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print("Download complete.")
except Exception as e:
    print(f"Download failed: {e}")
