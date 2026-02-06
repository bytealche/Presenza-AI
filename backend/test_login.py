import requests
import sys

API_URL = "http://127.0.0.1:8000"

def test_flow():
    email = "test_auth_v2@example.com"
    password = "password123"
    
    # 1. Register (Standard, not face for simplicity, or we can use face endpoint if needed)
    # The current auth flow supports standard login for ALL users, regardless of how they registered.
    # Let's use the standard create_user endpoint first to test pure auth logic.
    
    print(f"1. Registering user {email}...")
    reg_data = {
        "full_name": "Test Auth User",
        "email": email,
        "password": password,
        "org_id": 1,
        "role_id": 3
    }
    
    # Check if user exists first?
    # actually create_user might fail if exists, that's fine.
    
    try:
        resp = requests.post(f"{API_URL}/users/", json=reg_data)
        if resp.status_code == 200:
            print("   Registration successful.")
        else:
            print(f"   Registration status: {resp.status_code}")
            print(f"   Response: {resp.text}")
            # If 400, maybe already exists, try login anyway
            
    except Exception as e:
        print(f"   Registration failed: {e}")
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
    test_flow()
