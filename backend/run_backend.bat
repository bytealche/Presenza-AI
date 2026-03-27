@echo off
cd /d "C:\Users\Aniket\Downloads\Presenza-AI\backend"
call .venv\Scripts\activate.bat
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
