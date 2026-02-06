import requests
import os

API_URL = "http://127.0.0.1:8000"
IMAGE_PATH = "app/ai_engine/test_face.jpg"

def test_face_reg_auth():
    email = "face_auth_test@example.com"
    password = "secureFacePassword123"
    
    # Check if image exists
    if not os.path.exists(IMAGE_PATH):
        print(f"Error: {IMAGE_PATH} not found.")
        return

    print(f"1. Registering via Face {email}...")
    
    with open(IMAGE_PATH, "rb") as f:
        files = {"file": f}
        data = {
            "full_name": "Face Auth User",
            "email": email,
            "password": password,
            "org_id": 1,
            "role_id": 2
        }
        
        try:
            resp = requests.post(f"{API_URL}/users/register-with-face", files=files, data=data)
            if resp.status_code == 200:
                print("   Registration successful.")
            elif resp.status_code == 400 and "Email already registered" in resp.text:
                print("   User already exists, proceeding to login.")
            else:
                print(f"   Registration failed: {resp.status_code} - {resp.text}")
                return
        except Exception as e:
            print(f"   Request error: {e}")
            return

    # 2. Login
    print(f"2. Logging in as {email}...")
    login_data = {
        "email": email,
        "password": password
    }
    
    try:
        resp = requests.post(f"{API_URL}/auth/login", json=login_data)
        if resp.status_code == 200:
            print("   Login successful!")
            print(f"   Token: {resp.json().get('access_token')[:20]}...")
        else:
            print(f"   Login failed with {resp.status_code}")
            print(f"   Response: {resp.text}")
            
    except Exception as e:
        print(f"   Login failed: {e}")

if __name__ == "__main__":
    test_face_reg_auth()
