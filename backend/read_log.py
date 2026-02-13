import os

log_file = "server.log"

if not os.path.exists(log_file):
    print("Log file not found.")
    exit()

try:
    with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        print("--- LAST 100 LINES ---")
        for line in lines[-100:]:
            print(line.strip())
except Exception as e:
    print(f"Error reading log: {e}")
