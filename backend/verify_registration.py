import requests
import os
import time

BASE_URL = "http://127.0.0.1:8000"
IMG_PATH = "app/ai_engine/test_face.jpg"

if not os.path.exists(IMG_PATH):
    # Try finding it relative to backend root
    if os.path.exists("backend/app/ai_engine/test_face.jpg"):
        IMG_PATH = "backend/app/ai_engine/test_face.jpg"

if not os.path.exists(IMG_PATH):
    print(f"Error: {IMG_PATH} not found.")
    exit(1)

def register_face(email="verify@example.com", name="Verification User"):
    print(f"\nTesting Registration for {email}...")
    with open(IMG_PATH, "rb") as f:
        files = {"file": ("test_face.jpg", f, "image/jpeg")}
        data = {
            "full_name": name,
            "email": email,
            "password": "securepassword",
            "org_id": 1,
            "role_id": 1
        }
        try:
            response = requests.post(f"{BASE_URL}/users/register-with-face", data=data, files=files)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            return response.json()
        except Exception as e:
            print(f"Request failed: {e}")
            return None

def main():
    # 1. First Registration
    print("--- 1. Registering New User ---")
    user1 = register_face()
    
    if not user1 or "user_id" not in user1:
        print("Failed to register user 1.")
        return

    user_id_1 = user1["user_id"]
    print(f"User 1 ID: {user_id_1}")

    # 2. Duplicate Check (Same Face, Different Email)
    print("\n--- 2. Checking Duplicate Face ---")
    # Even if email is different, face match should return original user
    user2 = register_face(email="duplicate@example.com", name="Duplicate User")
    
    if not user2:
        print("Failed to register user 2.")
        return

    user_id_2 = user2["user_id"]
    print(f"User 2 ID: {user_id_2}")

    if user_id_1 == user_id_2:
        print("SUCCESS: Duplicate face returned existing user ID!")
    else:
        print("FAILURE: Duplicate face created new user ID!")

if __name__ == "__main__":
    main()
