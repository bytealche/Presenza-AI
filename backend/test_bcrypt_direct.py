import bcrypt
import traceback

def test_bcrypt_direct():
    print("Testing direct bcrypt usage...")
    password = "securepassword"
    pwd_bytes = password.encode('utf-8')
    
    try:
        # Generate hash
        hashed = bcrypt.hashpw(pwd_bytes, bcrypt.gensalt())
        print(f"Hash generated: {hashed}")
        
        # Verify hash
        if bcrypt.checkpw(pwd_bytes, hashed):
            print("Verification successful!")
        else:
            print("Verification failed!")
            
    except Exception as e:
        print(f"Direct bcrypt failed: {e}")
        traceback.print_exc()

    print("\nTesting 72 bytes limit behavior with direct bcrypt...")
    long_pwd = ("a" * 72).encode('utf-8')
    try:
        bcrypt.hashpw(long_pwd, bcrypt.gensalt())
        print("72 bytes OK")
    except Exception as e:
        print(f"72 bytes failed: {e}")

    try:
        very_long = ("a" * 73).encode('utf-8')
        bcrypt.hashpw(very_long, bcrypt.gensalt())
        print("73 bytes OK (Unexpected)")
    except Exception as e:
        print(f"73 bytes failed as expected: {e}")

if __name__ == "__main__":
    test_bcrypt_direct()
