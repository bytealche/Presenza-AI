import sqlite3

def check_schema():
    conn = sqlite3.connect('presenza.db')
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", tables)
    cursor.execute("PRAGMA table_info(camera_devices)")
    columns = cursor.fetchall()
    print("Columns in camera_devices:")
    for col in columns:
        print(col)
    conn.close()

if __name__ == "__main__":
    check_schema()
