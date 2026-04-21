# PresenzaAI (FastAPI + React Vite)

This project now has:
- FastAPI backend in the project root
- React + Vite frontend in `frontend/`

## 1) Run Backend

Install Python dependencies:

```powershell
pip install -r requirements.txt
```

Start API server from this folder:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## 2) Run Frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173` and calls backend via `VITE_API_BASE_URL`.

## Auth Setup

- Auth routes are in `auth.py` (separate from `main.py`)
- Roles supported: `admin`, `faculty`, `student`
- Set production secret before deployment:

```powershell
setx AUTH_SECRET_KEY "your-strong-secret"
```

## API Endpoint Mapping (React)

- `POST /auth/register` -> Register page
- `POST /auth/login` -> Login page
- `GET /auth/me` -> Session restore
- `GET /attendance_stats` -> Dashboard trend
- `GET /attendance_records?period=...` -> Dashboard records table
- `GET /train_model` -> Start training button
- `GET /train_status` -> Training progress
- `POST /add_student` -> Validate student form
- `POST /upload_face` -> Upload student photos
- `POST /check_face_duplicate` -> Duplicate face check
- `POST /recognize_face` -> Single-face attendance
- `POST /recognize_faces` -> Multi-face attendance
- `POST /cctv/start` -> CCTV start
- `POST /cctv/stop` -> CCTV stop
- `GET /cctv/status` -> CCTV status
- `GET /students` -> Students list
- `DELETE /students/{sid}` -> Delete student
- `GET /download_csv` -> Attendance CSV download
- `GET /attendance_record` -> Legacy HTML report shortcut
