from app.core.security import hash_password
import sys

try:
    print("Testing hash_password with 'securepassword'...")
    h = hash_password("securepassword")
    print(f"Success! Hash: {h[:10]}...")
except Exception as e:
    print(f"FAILED: {e}")
    import traceback
    traceback.print_exc()

try:
    print("\nTesting hash_password with 64-char password...")
    long_pwd = "a" * 64
    h = hash_password(long_pwd)
    print(f"Success! Hash: {h[:10]}...")
except Exception as e:
    print(f"FAILED: {e}")
    traceback.print_exc()

try:
    print("\nTesting hash_password with 72-char password...")
    long_pwd = "a" * 72
    h = hash_password(long_pwd)
    print(f"Success! Hash: {h[:10]}...")
except Exception as e:
    print(f"Expected failure or success depending on byte encoding: {e}")
except ValueError as e:
    print(f"Expected ValueError: {e}")
