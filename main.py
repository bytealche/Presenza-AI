import csv
import datetime
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import threading
import time
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from jinja2 import pass_context

from auth import build_auth_router, init_auth_tables

APP_DIR = Path(__file__).resolve().parent

def resolve_project_root():
    candidates = [
        APP_DIR,
        APP_DIR.parent
    ]
    for candidate in candidates:
        if (candidate / "model.py").exists():
            return candidate
    return APP_DIR.parent


PROJECT_ROOT = resolve_project_root()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from model import (  # noqa: E402
    extract_embeddings_for_bgr_image,
    extract_embeddings_for_image,
    load_model_if_exists,
    predict_with_model,
    remove_student_embedding_profile,
    train_model_background,
    upsert_student_embedding_profile,
)

DB_PATH = PROJECT_ROOT / "attendance.db"
DATASET_DIR = PROJECT_ROOT / "dataset"
TRAIN_STATUS_FILE = PROJECT_ROOT / "train_status.json"
ATTENDANCE_CONFIDENCE_THRESHOLD = 0.75
CCTV_SCAN_INTERVAL_SECONDS = 2.0
RECOGNITION_CONFIRMATION_COUNT = 4
LIVENESS_MIN_SIGNATURE_FRAMES = 4
LIVENESS_SIGNATURE_STD_THRESHOLD = 0.012
LIVENESS_SIGNATURE_MIN_ACTIVE_DIMS = 2
LIVENESS_YAW_PROXY_RANGE_MIN = 0.045
LIVENESS_PITCH_PROXY_RANGE_MIN = 0.025
LIVENESS_YAW_PROXY_POS_MIN = 0.02
LIVENESS_YAW_PROXY_NEG_MAX = -0.02
LIVENESS_YAW_DERIV_EPS = 0.004
LIVENESS_YAW_DIRECTION_CHANGES_MIN = 1
LIVENESS_PASSIVE_SPOOF_MEAN_HARD = 0.42
LIVENESS_PASSIVE_SPOOF_MEAN_SOFT = 0.56
LIVENESS_MIN_SPOOF_SAMPLES = 4
LIVENESS_PASSIVE_SPOOF_MAX_SINGLE = 0.45
ATTENDANCE_MAX_SPOOF_PER_FRAME = 0.40
LIVENESS_EYE_MOTION_DIFF_THRESHOLD = 0.018
LIVENESS_EYE_MOTION_MIN_SAMPLES = 4
LIVENESS_EYE_MOTION_MIN_EVENTS = 2
LIVENESS_NONRIGID_EYE_MOTION_THRESHOLD = 0.012
LIVENESS_FACE_MOTION_MIN_SAMPLES = 4
LIVENESS_FACE_CENTER_RANGE_MIN = 0.14
LIVENESS_FACE_SCALE_RANGE_MIN = 0.10
FACE_DUPLICATE_SIMILARITY_THRESHOLD = 0.78
FACE_FRAME_SIMILARITY_THRESHOLD = 0.97
REGISTRATION_MAX_IMAGES_TO_PROCESS = 50
REGISTRATION_SPOOF_MEAN_MAX = 0.48
REGISTRATION_SPOOF_MAX_SINGLE = 0.78
REGISTRATION_EYE_MOTION_DIFF_THRESHOLD = 0.035
REGISTRATION_EYE_MOTION_MIN_EVENTS = 2
REGISTRATION_EYE_MOTION_MIN_SAMPLES = 5
REGISTRATION_MIN_FACE_FRAMES = 15
REGISTRATION_MIN_LIVE_FRAMES = 12
REGISTRATION_MIN_LIVE_RATIO = 0.70
REGISTRATION_SIGNATURE_STD_THRESHOLD = 0.0045
REGISTRATION_SIGNATURE_MIN_ACTIVE_DIMS = 2
REGISTRATION_MIN_SIGNATURE_FRAMES = 8

DATASET_DIR.mkdir(exist_ok=True)

app = FastAPI(title="PresenzaAI FastAPI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=str(PROJECT_ROOT / "static")), name="static")
templates = Jinja2Templates(directory=str(PROJECT_ROOT / "templates"))
app.include_router(build_auth_router(DB_PATH))


@pass_context
def flask_compatible_url_for(context, name, **path_params):
    request = context["request"]
    static_file = None
    if name == "static" and "filename" in path_params:
        static_file = path_params["filename"]
        path_params["path"] = path_params.pop("filename")
    url = request.url_for(name, **path_params)
    if name == "static" and static_file:
        file_path = PROJECT_ROOT / "static" / static_file
        if file_path.exists():
            return url.include_query_params(v=int(file_path.stat().st_mtime))
    return url


templates.env.globals["url_for"] = flask_compatible_url_for

cctv_state = {
    "running": False,
    "source": "0",
    "message": "Idle",
    "face_count": 0,
    "spoof_count": 0,
    "recognized": [],
    "last_scan_at": None,
}
cctv_lock = threading.Lock()
cctv_stop_event = threading.Event()
cctv_thread = None
recognition_memory = {}


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                roll TEXT,
                class TEXT,
                section TEXT,
                enrollment_no TEXT,
                created_at TEXT
            )"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER,
                name TEXT,
                timestamp TEXT
            )"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS deleted_students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_student_id INTEGER UNIQUE,
                name TEXT NOT NULL,
                enrollment_no TEXT,
                roll TEXT,
                class TEXT,
                section TEXT,
                created_at TEXT,
                deleted_at TEXT NOT NULL
            )"""
    )
    c.execute("PRAGMA table_info(students)")
    student_columns = {row[1] for row in c.fetchall()}
    if "enrollment_no" not in student_columns:
        c.execute("ALTER TABLE students ADD COLUMN enrollment_no TEXT")
    if "reg_no" in student_columns:
        c.execute(
            """
            UPDATE students
            SET enrollment_no = reg_no
            WHERE (enrollment_no IS NULL OR trim(enrollment_no) = '')
              AND reg_no IS NOT NULL
              AND trim(reg_no) <> ''
            """
        )
    conn.commit()
    conn.close()


def get_student_row(student_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, enrollment_no FROM students WHERE id=?", (student_id,))
    row = c.fetchone()
    conn.close()
    return row


def is_valid_enrollment_no(value):
    return bool(re.fullmatch(r"[A-Za-z0-9]+", value))


def find_student_by_enrollment_no(enrollment_no):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, name, enrollment_no FROM students WHERE lower(enrollment_no)=lower(?) LIMIT 1",
        (enrollment_no,),
    )
    row = c.fetchone()
    conn.close()
    return row


def fetch_existing_student_ids():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM students")
    rows = c.fetchall()
    conn.close()
    return {int(row[0]) for row in rows}


def iter_student_dataset_embeddings(skip_student_id=None):
    for sid in os.listdir(DATASET_DIR):
        folder = DATASET_DIR / sid
        if not folder.is_dir():
            continue
        try:
            sid_int = int(sid)
        except ValueError:
            continue
        if skip_student_id is not None and sid_int == skip_student_id:
            continue
        embeddings = []
        for fn in os.listdir(folder):
            if not fn.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            path = folder / fn
            img = cv2.imread(str(path))
            if img is None:
                continue
            detections = extract_embeddings_for_bgr_image(img)
            if not detections:
                continue
            embeddings.append(detections[0]["embedding"])
        if embeddings:
            yield sid_int, embeddings


def mean_embedding(embeddings):
    if not embeddings:
        return None
    matrix = np.stack(embeddings)
    mean = np.mean(matrix, axis=0)
    norm = np.linalg.norm(mean)
    if norm == 0:
        return None
    return mean / norm


def cosine_similarity(emb_a, emb_b):
    return float(np.dot(emb_a, emb_b))


def extract_eye_patches(gray_image, keypoints):
    if gray_image is None or keypoints is None or len(keypoints) < 2:
        return None, None
    h, w = gray_image.shape[:2]
    points = np.asarray(keypoints, dtype=np.float32)
    left_eye = points[0]
    right_eye = points[1]
    eye_dist = float(np.linalg.norm(right_eye - left_eye))
    if eye_dist <= 1.0:
        return None, None

    # Eye patch around each eye center, scaled by inter-eye distance.
    patch_w = max(12, int(eye_dist * 0.9))
    patch_h = max(8, int(eye_dist * 0.5))

    def crop_eye(center):
        cx, cy = int(center[0]), int(center[1])
        x1 = max(0, cx - patch_w // 2)
        x2 = min(w, cx + patch_w // 2)
        y1 = max(0, cy - patch_h // 2)
        y2 = min(h, cy + patch_h // 2)
        if x2 <= x1 or y2 <= y1:
            return None
        patch = gray_image[y1:y2, x1:x2]
        if patch.size == 0:
            return None
        return cv2.resize(patch, (24, 12), interpolation=cv2.INTER_AREA)

    return crop_eye(left_eye), crop_eye(right_eye)


def eye_patch_motion(prev_patch, cur_patch):
    if prev_patch is None or cur_patch is None:
        return 0.0
    if prev_patch.shape != cur_patch.shape:
        return 0.0
    prev_f = prev_patch.astype(np.float32)
    cur_f = cur_patch.astype(np.float32)
    diff = np.mean(np.abs(cur_f - prev_f)) / 255.0
    return float(diff)


def eye_patch_nonrigid_motion(prev_patch, cur_patch):
    if prev_patch is None or cur_patch is None:
        return 0.0
    if prev_patch.shape != cur_patch.shape:
        return 0.0
    prev_f = prev_patch.astype(np.float32)
    cur_f = cur_patch.astype(np.float32)
    h, w = prev_f.shape[:2]
    if h < 4 or w < 4:
        return 0.0
    try:
        shift, _ = cv2.phaseCorrelate(prev_f, cur_f)
        dx, dy = float(shift[0]), float(shift[1])
        # If shift is unreasonable, skip compensation and treat as rigid mismatch.
        if abs(dx) > w * 0.35 or abs(dy) > h * 0.35:
            return 0.0
        warp = np.array([[1.0, 0.0, dx], [0.0, 1.0, dy]], dtype=np.float32)
        aligned_prev = cv2.warpAffine(
            prev_f,
            warp,
            (w, h),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REFLECT_101,
        )
        residual = np.mean(np.abs(cur_f - aligned_prev)) / 255.0
        return float(residual)
    except Exception:
        return 0.0


def extract_face_patch(gray_image, bbox):
    if gray_image is None or bbox is None or len(bbox) < 4:
        return None
    h, w = gray_image.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    x1 = max(0, min(x1, w - 1))
    y1 = max(0, min(y1, h - 1))
    x2 = max(x1 + 1, min(x2, w))
    y2 = max(y1 + 1, min(y2, h))
    patch = gray_image[y1:y2, x1:x2]
    if patch.size == 0:
        return None
    return cv2.resize(patch, (48, 48), interpolation=cv2.INTER_AREA)


def has_registration_geometry_variation(signatures):
    if not signatures or len(signatures) < REGISTRATION_MIN_SIGNATURE_FRAMES:
        return False
    arr = np.asarray(signatures, dtype=np.float32)
    if arr.ndim != 2 or arr.shape[1] != 4:
        return False
    per_dim_std = np.std(arr, axis=0)
    active_dims = int(np.sum(per_dim_std >= REGISTRATION_SIGNATURE_STD_THRESHOLD))
    return active_dims >= REGISTRATION_SIGNATURE_MIN_ACTIVE_DIMS


def evaluate_registration_liveness(total_face_frames, live_frame_count, spoof_scores, eye_motion_values, signatures):
    if not spoof_scores:
        return False, "no usable live face frames found"
    if total_face_frames < REGISTRATION_MIN_FACE_FRAMES:
        return False, "not enough face frames captured; keep your face in camera for full capture"
    if live_frame_count < REGISTRATION_MIN_LIVE_FRAMES:
        return False, "not enough live frames detected; avoid mobile screen/photo/video input"
    live_ratio = float(live_frame_count / max(total_face_frames, 1))
    if live_ratio < REGISTRATION_MIN_LIVE_RATIO:
        return False, "too many spoof-like frames detected; use a real live face only"
    mean_spoof = float(np.mean(spoof_scores))
    max_spoof = float(np.max(spoof_scores))
    if mean_spoof > REGISTRATION_SPOOF_MEAN_MAX or max_spoof > REGISTRATION_SPOOF_MAX_SINGLE:
        return False, "spoof risk too high: please avoid phone screen/photo/video input"

    if len(eye_motion_values) < REGISTRATION_EYE_MOTION_MIN_SAMPLES:
        return False, "insufficient live eye-motion samples; keep eyes visible and face the camera"
    motion_events = sum(v >= REGISTRATION_EYE_MOTION_DIFF_THRESHOLD for v in eye_motion_values)
    if motion_events < REGISTRATION_EYE_MOTION_MIN_EVENTS:
        return False, "insufficient natural eye movement detected; avoid static photos or replay videos"
    if not has_registration_geometry_variation(signatures):
        return False, "insufficient natural facial motion detected; move naturally during capture"
    return True, None


def find_duplicate_face_owner(candidate_embeddings, skip_student_id=None):
    candidate_mean = mean_embedding(candidate_embeddings)
    if candidate_mean is None:
        return None

    best_match = None
    best_score = -1.0
    existing_student_ids = fetch_existing_student_ids()

    # Fast path: compare against precomputed student mean embeddings.
    model_data = load_model_if_exists()
    students = model_data.get("students", {}) if isinstance(model_data, dict) else {}
    if isinstance(students, dict):
        for sid, student_data in students.items():
            try:
                sid_int = int(sid)
            except (TypeError, ValueError):
                continue
            if skip_student_id is not None and sid_int == skip_student_id:
                continue
            if sid_int not in existing_student_ids:
                continue
            reference = student_data.get("mean_embedding") if isinstance(student_data, dict) else None
            if reference is None:
                continue
            score = cosine_similarity(candidate_mean, reference)
            if score > best_score:
                best_score = score
                best_match = sid_int
        if best_match is not None:
            if best_score < FACE_DUPLICATE_SIMILARITY_THRESHOLD:
                return None
            return best_match, best_score

    # Fallback path: compute means from dataset images when model is unavailable.
    for sid, existing_embeddings in iter_student_dataset_embeddings(skip_student_id=skip_student_id):
        if sid not in existing_student_ids:
            continue
        existing_mean = mean_embedding(existing_embeddings)
        if existing_mean is None:
            continue
        score = cosine_similarity(candidate_mean, existing_mean)
        if score > best_score:
            best_score = score
            best_match = sid
    if best_match is None or best_score < FACE_DUPLICATE_SIMILARITY_THRESHOLD:
        return None
    return best_match, best_score


def write_train_status(status_dict):
    with open(TRAIN_STATUS_FILE, "w", encoding="utf-8") as f:
        json.dump(status_dict, f)


def read_train_status():
    if not TRAIN_STATUS_FILE.exists():
        return {"running": False, "progress": 0, "message": "Not trained"}
    with open(TRAIN_STATUS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_source(source_value):
    source_str = str(source_value).strip()
    if not source_str:
        return 0, "0"
    if source_str.isdigit():
        return int(source_str), source_str
    return source_str, source_str


def fetch_student_names(student_ids):
    if not student_ids:
        return {}
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    placeholders = ",".join("?" for _ in student_ids)
    c.execute(f"SELECT id, name FROM students WHERE id IN ({placeholders})", tuple(student_ids))
    rows = c.fetchall()
    conn.close()
    return {row[0]: row[1] for row in rows}


def build_attendance_rows(period: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    q = """
        SELECT
            COALESCE(s.roll, ds.roll) AS roll,
            COALESCE(s.enrollment_no, ds.enrollment_no) AS enrollment_no,
            a.name,
            a.timestamp
        FROM attendance a
        LEFT JOIN students s ON s.id = a.student_id
        LEFT JOIN deleted_students ds ON ds.original_student_id = a.student_id
    """
    params = ()
    if period == "daily":
        today = datetime.date.today().isoformat()
        q += " WHERE date(a.timestamp) = ?"
        params = (today,)
    elif period == "weekly":
        start = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
        q += " WHERE date(a.timestamp) >= ?"
        params = (start,)
    elif period == "monthly":
        start = (datetime.date.today() - datetime.timedelta(days=30)).isoformat()
        q += " WHERE date(a.timestamp) >= ?"
        params = (start,)
    q += " ORDER BY a.timestamp DESC LIMIT 5000"
    c.execute(q, params)
    rows = []
    ist_offset = datetime.timedelta(hours=5, minutes=30)
    for roll, enrollment_no, name, timestamp in c.fetchall():
        display_ts = timestamp
        try:
            utc_dt = datetime.datetime.fromisoformat(timestamp)
            ist_dt = utc_dt + ist_offset
            display_ts = ist_dt.strftime("%Y-%m-%d %I:%M:%S %p")
        except (TypeError, ValueError):
            pass
        rows.append((roll or "-", enrollment_no or "-", name, display_ts))
    conn.close()
    return rows


def mark_attendance_once_per_day(student_id, name):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    today = datetime.date.today().isoformat()
    c.execute(
        "SELECT 1 FROM attendance WHERE student_id=? AND date(timestamp)=? LIMIT 1",
        (student_id, today),
    )
    already_marked = c.fetchone() is not None
    if already_marked:
        conn.close()
        return False, None
    ts = datetime.datetime.utcnow().isoformat()
    c.execute(
        "INSERT INTO attendance (student_id, name, timestamp) VALUES (?, ?, ?)",
        (student_id, name, ts),
    )
    conn.commit()
    conn.close()
    return True, ts


def train_model_worker():
    try:
        train_model_background(
            str(DATASET_DIR),
            lambda p, m: write_train_status({"running": True, "progress": p, "message": m}),
        )
        status = read_train_status()
        if status.get("progress") != 100:
            write_train_status({"running": False, "progress": 0, "message": status.get("message", "Training failed")})
        else:
            write_train_status({"running": False, "progress": 100, "message": "Training complete"})
    except Exception as exc:
        write_train_status({"running": False, "progress": 0, "message": f"Training failed: {exc}"})


def confirm_recognition(source_key, recognized_candidates, frame_bgr=None):
    memory = recognition_memory.setdefault(source_key, {})
    active_ids = set()
    confirmed = []
    gray_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY) if frame_bgr is not None else None

    for item in recognized_candidates:
        sid = item["student_id"]
        active_ids.add(sid)
        state = memory.setdefault(
            sid,
            {
                "count": 0,
                "signatures": [],
                "spoof_scores": [],
                "eye_motion_values": [],
                "nonrigid_eye_motion_values": [],
                "face_centers": [],
                "face_scales": [],
                "prev_left_eye_patch": None,
                "prev_right_eye_patch": None,
                "prev_face_patch": None,
            },
        )
        state["count"] = int(state.get("count", 0)) + 1
        signature = item.get("geometry_signature")
        if signature is not None:
            signatures = state.setdefault("signatures", [])
            signatures.append(signature)
            if len(signatures) > 10:
                del signatures[:-10]
        bbox = item.get("bbox")
        if bbox is not None and len(bbox) >= 4:
            try:
                x1, y1, x2, y2 = [float(v) for v in bbox]
                bw = max(1.0, x2 - x1)
                bh = max(1.0, y2 - y1)
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0
                centers = state.setdefault("face_centers", [])
                scales = state.setdefault("face_scales", [])
                centers.append((cx, cy, bw, bh))
                scales.append((bw, bh))
                if len(centers) > 12:
                    del centers[:-12]
                if len(scales) > 12:
                    del scales[:-12]
            except Exception:
                pass
        if gray_frame is not None:
            left_patch, right_patch = extract_eye_patches(gray_frame, item.get("kps"))
            prev_left = state.get("prev_left_eye_patch")
            prev_right = state.get("prev_right_eye_patch")
            eye_motion_values = state.setdefault("eye_motion_values", [])
            nonrigid_eye_motion_values = state.setdefault("nonrigid_eye_motion_values", [])
            if prev_left is not None and left_patch is not None:
                eye_motion_values.append(eye_patch_motion(prev_left, left_patch))
                nonrigid_eye_motion_values.append(eye_patch_nonrigid_motion(prev_left, left_patch))
            if prev_right is not None and right_patch is not None:
                eye_motion_values.append(eye_patch_motion(prev_right, right_patch))
                nonrigid_eye_motion_values.append(eye_patch_nonrigid_motion(prev_right, right_patch))
            if len(eye_motion_values) > 12:
                del eye_motion_values[:-12]
            if len(nonrigid_eye_motion_values) > 12:
                del nonrigid_eye_motion_values[:-12]
            face_patch = extract_face_patch(gray_frame, item.get("bbox"))
            prev_face_patch = state.get("prev_face_patch")
            _ = eye_patch_motion(prev_face_patch, face_patch)
            state["prev_left_eye_patch"] = left_patch
            state["prev_right_eye_patch"] = right_patch
            state["prev_face_patch"] = face_patch
        spoof_scores = state.setdefault("spoof_scores", [])
        spoof_scores.append(float(item.get("spoof_score", 1.0)))
        if len(spoof_scores) > 10:
            del spoof_scores[:-10]

        if state["count"] >= RECOGNITION_CONFIRMATION_COUNT and has_passive_live_evidence(
            state.get("signatures", []),
            state.get("spoof_scores", []),
            state.get("eye_motion_values", []),
            state.get("nonrigid_eye_motion_values", []),
            state.get("face_centers", []),
            state.get("face_scales", []),
        ):
            confirmed.append(item)
            state["count"] = 0
            state["signatures"] = []
            state["spoof_scores"] = []
            state["eye_motion_values"] = []
            state["nonrigid_eye_motion_values"] = []
            state["face_centers"] = []
            state["face_scales"] = []
            state["prev_left_eye_patch"] = None
            state["prev_right_eye_patch"] = None
            state["prev_face_patch"] = None

    stale_ids = [sid for sid in memory if sid not in active_ids]
    for sid in stale_ids:
        memory[sid] = {
            "count": 0,
            "signatures": [],
            "spoof_scores": [],
            "eye_motion_values": [],
            "nonrigid_eye_motion_values": [],
            "face_centers": [],
            "face_scales": [],
            "prev_left_eye_patch": None,
            "prev_right_eye_patch": None,
            "prev_face_patch": None,
        }

    return confirmed


def build_geometry_signature(item):
    kps = item.get("kps")
    if not kps or len(kps) < 5:
        return None
    try:
        pts = np.asarray(kps, dtype=np.float32)
        left_eye = pts[0]
        right_eye = pts[1]
        nose = pts[2]
        mouth_left = pts[3]
        mouth_right = pts[4]
        eye_dist = float(np.linalg.norm(right_eye - left_eye))
        if eye_dist <= 1e-6:
            return None
        mouth_mid = (mouth_left + mouth_right) / 2.0
        return (
            float(np.linalg.norm(nose - left_eye) / eye_dist),
            float(np.linalg.norm(nose - right_eye) / eye_dist),
            float(np.linalg.norm(mouth_right - mouth_left) / eye_dist),
            float(np.linalg.norm(nose - mouth_mid) / eye_dist),
        )
    except Exception:
        return None


def has_live_geometry_variation(signatures):
    if not signatures or len(signatures) < LIVENESS_MIN_SIGNATURE_FRAMES:
        return False
    arr = np.asarray(signatures, dtype=np.float32)
    if arr.ndim != 2 or arr.shape[1] != 4:
        return False
    per_dim_std = np.std(arr, axis=0)
    active_dims = int(np.sum(per_dim_std >= LIVENESS_SIGNATURE_STD_THRESHOLD))
    if active_dims < LIVENESS_SIGNATURE_MIN_ACTIVE_DIMS:
        return False

    # Pose-change proxies derived from landmark geometry signature:
    # sig[0]-sig[1]: yaw-like asymmetry, sig[3]: nose-to-mouth depth-like change.
    yaw_proxy = arr[:, 0] - arr[:, 1]
    pitch_proxy = arr[:, 3]
    yaw_range = float(np.max(yaw_proxy) - np.min(yaw_proxy))
    pitch_range = float(np.max(pitch_proxy) - np.min(pitch_proxy))
    if yaw_range < LIVENESS_YAW_PROXY_RANGE_MIN:
        return False
    if pitch_range < LIVENESS_PITCH_PROXY_RANGE_MIN:
        return False
    # Require yaw to cross both sides (left and right) and show directional change.
    if float(np.max(yaw_proxy)) < LIVENESS_YAW_PROXY_POS_MIN:
        return False
    if float(np.min(yaw_proxy)) > LIVENESS_YAW_PROXY_NEG_MAX:
        return False
    yaw_delta = np.diff(yaw_proxy)
    if yaw_delta.size == 0:
        return False
    significant = yaw_delta[np.abs(yaw_delta) >= LIVENESS_YAW_DERIV_EPS]
    if significant.size == 0:
        return False
    yaw_sign = np.sign(significant)
    direction_changes = int(np.sum(yaw_sign[1:] != yaw_sign[:-1])) if yaw_sign.size > 1 else 0
    if direction_changes < LIVENESS_YAW_DIRECTION_CHANGES_MIN:
        return False
    return True


def has_face_motion_evidence(face_centers, face_scales):
    if not face_centers or len(face_centers) < LIVENESS_FACE_MOTION_MIN_SAMPLES:
        return False
    arr = np.asarray(face_centers, dtype=np.float32)
    if arr.ndim != 2 or arr.shape[1] != 4:
        return False
    cx = arr[:, 0]
    cy = arr[:, 1]
    bw = arr[:, 2]
    bh = arr[:, 3]
    norm_w = float(max(np.median(bw), 1.0))
    norm_h = float(max(np.median(bh), 1.0))
    center_range_x = float((np.max(cx) - np.min(cx)) / norm_w)
    center_range_y = float((np.max(cy) - np.min(cy)) / norm_h)

    if not face_scales:
        return False
    sarr = np.asarray(face_scales, dtype=np.float32)
    if sarr.ndim != 2 or sarr.shape[1] != 2:
        return False
    areas = sarr[:, 0] * sarr[:, 1]
    area_med = float(max(np.median(areas), 1.0))
    scale_range = float((np.max(areas) - np.min(areas)) / area_med)
    return (
        center_range_x >= LIVENESS_FACE_CENTER_RANGE_MIN
        or center_range_y >= LIVENESS_FACE_CENTER_RANGE_MIN
        or scale_range >= LIVENESS_FACE_SCALE_RANGE_MIN
    )


def has_passive_live_evidence(
    signatures, spoof_scores, eye_motion_values, nonrigid_eye_motion_values, face_centers, face_scales
):
    if not spoof_scores:
        return False
    if len(spoof_scores) < LIVENESS_MIN_SPOOF_SAMPLES:
        return False
    recent_scores = spoof_scores[-max(RECOGNITION_CONFIRMATION_COUNT, 5) :]
    if float(np.max(recent_scores)) > LIVENESS_PASSIVE_SPOOF_MAX_SINGLE:
        return False
    mean_spoof = float(np.mean(recent_scores))
    if mean_spoof > LIVENESS_PASSIVE_SPOOF_MEAN_SOFT:
        return False
    if len(eye_motion_values) < LIVENESS_EYE_MOTION_MIN_SAMPLES:
        return False
    eye_motion_events = sum(v >= LIVENESS_EYE_MOTION_DIFF_THRESHOLD for v in eye_motion_values)
    if eye_motion_events < LIVENESS_EYE_MOTION_MIN_EVENTS:
        return False
    nonrigid_events = sum(v >= LIVENESS_NONRIGID_EYE_MOTION_THRESHOLD for v in nonrigid_eye_motion_values)
    if nonrigid_events < LIVENESS_EYE_MOTION_MIN_EVENTS:
        return False
    if not has_face_motion_evidence(face_centers, face_scales):
        return False
    # Attendance confirmation must include temporal geometry variation to block static photos/screens.
    return has_live_geometry_variation(signatures)


def recognize_embeddings(embedding_items):
    if not embedding_items:
        return []
    clf = load_model_if_exists()
    if clf is None:
        return []

    predictions = []
    student_ids = []
    for item in embedding_items:
        label, conf = predict_with_model(clf, item["embedding"])
        if conf >= ATTENDANCE_CONFIDENCE_THRESHOLD:
            student_ids.append(int(label))
            predictions.append(
                {
                    "student_id": int(label),
                    "confidence": float(conf),
                    "bbox": item["bbox"],
                    "kps": item.get("kps"),
                    "geometry_signature": build_geometry_signature(item),
                    "spoof_score": float(item.get("spoof_score", 1.0)),
                }
            )

    if not predictions:
        return []

    names = fetch_student_names(sorted(set(student_ids)))
    recognized = []
    seen_ids = set()
    for pred in predictions:
        sid = pred["student_id"]
        if sid in seen_ids or sid not in names:
            continue
        seen_ids.add(sid)
        recognized.append(
            {
                "student_id": sid,
                "name": names[sid],
                "confidence": pred["confidence"],
                "bbox": pred["bbox"],
                "kps": pred.get("kps"),
                "geometry_signature": pred.get("geometry_signature"),
                "spoof_score": pred.get("spoof_score", 1.0),
            }
        )
    return recognized


def process_frame_embeddings(embedding_items, source_key="default", frame_bgr=None):
    live_items = [
        item
        for item in embedding_items
        if item.get("is_live", True) and float(item.get("spoof_score", 1.0)) <= ATTENDANCE_MAX_SPOOF_PER_FRAME
    ]
    spoof_count = len(embedding_items) - len(live_items)
    recognized = recognize_embeddings(live_items)
    confirmed = confirm_recognition(source_key, recognized, frame_bgr=frame_bgr)
    finalized = []
    for item in confirmed:
        marked, timestamp = mark_attendance_once_per_day(item["student_id"], item["name"])
        finalized.append(
            {
                "student_id": item["student_id"],
                "name": item["name"],
                "confidence": item["confidence"],
                "bbox": item["bbox"],
                "marked": marked,
                "timestamp": timestamp,
            }
        )
    return {
        "face_count": len(embedding_items),
        "live_face_count": len(live_items),
        "spoof_count": spoof_count,
        "recognized_count": len(finalized),
        "recognized": finalized,
    }


def set_cctv_state(**kwargs):
    with cctv_lock:
        cctv_state.update(kwargs)


def run_cctv_scanner(source_value, source_label):
    recognition_memory.clear()
    set_cctv_state(
        running=True,
        source=source_label,
        message="Connecting to classroom camera...",
        face_count=0,
        spoof_count=0,
        recognized=[],
        last_scan_at=None,
    )
    cap = cv2.VideoCapture(source_value)
    if not cap.isOpened():
        set_cctv_state(running=False, message="Failed to open camera source")
        return

    try:
        while not cctv_stop_event.is_set():
            ok, frame = cap.read()
            if not ok or frame is None:
                set_cctv_state(message="Camera read failed. Retrying...")
                time.sleep(1.0)
                continue
            embedding_items = extract_embeddings_for_bgr_image(frame)
            result = process_frame_embeddings(embedding_items, source_key=f"cctv:{source_label}", frame_bgr=frame)
            set_cctv_state(
                running=True,
                source=source_label,
                message="Scanning classroom feed",
                face_count=result["face_count"],
                spoof_count=result["spoof_count"],
                recognized=result["recognized"],
                last_scan_at=datetime.datetime.utcnow().isoformat(),
            )
            time.sleep(CCTV_SCAN_INTERVAL_SECONDS)
    finally:
        cap.release()
        recognition_memory.clear()
        set_cctv_state(running=False, message="Scanner stopped")


@app.on_event("startup")
def startup_event():
    init_db()
    init_auth_tables(DB_PATH)
    write_train_status({"running": False, "progress": 0, "message": "No training yet."})


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(name="index.html", context={"request": request})


@app.get("/attendance_stats")
def attendance_stats():
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT timestamp FROM attendance", conn)
    conn.close()
    if df.empty:
        from datetime import date

        days = [(date.today() - datetime.timedelta(days=i)).strftime("%d-%b") for i in range(29, -1, -1)]
        return {"dates": days, "counts": [0] * 30}
    df["date"] = pd.to_datetime(df["timestamp"]).dt.date
    last_30 = [datetime.date.today() - datetime.timedelta(days=i) for i in range(29, -1, -1)]
    counts = [int(df[df["date"] == d].shape[0]) for d in last_30]
    dates = [d.strftime("%d-%b") for d in last_30]
    return {"dates": dates, "counts": counts}


@app.get("/add_student", response_class=HTMLResponse)
def add_student_page(request: Request):
    return templates.TemplateResponse(name="add_student.html", context={"request": request})


@app.post("/add_student")
def add_student(
    name: str = Form(""),
    enrollment_no: str = Form(""),
    roll: str = Form(""),
    class_name: str = Form("", alias="class"),
    sec: str = Form(""),
):
    name = name.strip()
    enrollment_no = enrollment_no.strip()
    roll = roll.strip()
    class_name = class_name.strip()
    sec = sec.strip()
    if not name:
        return JSONResponse({"error": "name required"}, status_code=400)
    if not enrollment_no:
        return JSONResponse({"error": "enrollment number required"}, status_code=400)
    if not is_valid_enrollment_no(enrollment_no):
        return JSONResponse({"error": "enrollment number must be alphanumeric"}, status_code=400)
    existing = find_student_by_enrollment_no(enrollment_no)
    if existing is not None:
        return JSONResponse(
            {
                "error": "enrollment number already exists",
                "student_id": existing[0],
                "name": existing[1],
                "enrollment_no": existing[2],
            },
            status_code=409,
        )
    return {"validated": True}


@app.post("/upload_face")
async def upload_face(
    name: str = Form(""),
    enrollment_no: str = Form(""),
    roll: str = Form(""),
    class_name: str = Form("", alias="class"),
    sec: str = Form(""),
    images: list[UploadFile] = File(..., alias="images[]"),
):
    name = name.strip()
    enrollment_no = enrollment_no.strip()
    roll = roll.strip()
    class_name = class_name.strip()
    sec = sec.strip()
    if not name:
        return JSONResponse({"error": "name required"}, status_code=400)
    if not enrollment_no:
        return JSONResponse({"error": "enrollment number required"}, status_code=400)
    if not is_valid_enrollment_no(enrollment_no):
        return JSONResponse({"error": "enrollment number must be alphanumeric"}, status_code=400)
    existing = find_student_by_enrollment_no(enrollment_no)
    if existing is not None:
        return JSONResponse(
            {
                "error": "enrollment number already exists",
                "student_id": existing[0],
                "name": existing[1],
                "enrollment_no": existing[2],
            },
            status_code=409,
        )
    if not images:
        return JSONResponse({"error": "no images uploaded"}, status_code=400)

    candidate_embeddings = []
    unique_batch_embeddings = []
    accepted_images = []
    skipped_similar_frames = 0
    spoof_rejected = 0
    registration_spoof_scores = []
    registration_signatures = []
    eye_motion_values = []
    prev_left_eye_patch = None
    prev_right_eye_patch = None
    for upload in images:
        if len(candidate_embeddings) >= REGISTRATION_MAX_IMAGES_TO_PROCESS:
            break
        try:
            raw = await upload.read()
            if not raw:
                continue
            embedding_items = extract_embeddings_for_image(raw)
            if not embedding_items:
                continue
            best_item = embedding_items[0]
            registration_spoof_scores.append(float(best_item.get("spoof_score", 1.0)))

            # Passive eye-motion signal: compare eye patches across captured frames.
            np_buf = np.frombuffer(raw, np.uint8)
            bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
            if bgr is not None:
                gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
                left_patch, right_patch = extract_eye_patches(gray, best_item.get("kps"))
                if prev_left_eye_patch is not None and left_patch is not None:
                    eye_motion_values.append(eye_patch_motion(prev_left_eye_patch, left_patch))
                if prev_right_eye_patch is not None and right_patch is not None:
                    eye_motion_values.append(eye_patch_motion(prev_right_eye_patch, right_patch))
                prev_left_eye_patch = left_patch
                prev_right_eye_patch = right_patch

            if not best_item.get("is_live", True):
                spoof_rejected += 1
                continue
            signature = build_geometry_signature(best_item)
            if signature is not None:
                registration_signatures.append(signature)
            embedding = best_item["embedding"]
            duplicate_in_batch = False
            for prev_embedding in unique_batch_embeddings:
                if cosine_similarity(embedding, prev_embedding) >= FACE_FRAME_SIMILARITY_THRESHOLD:
                    duplicate_in_batch = True
                    skipped_similar_frames += 1
                    break
            if duplicate_in_batch:
                continue
            unique_batch_embeddings.append(embedding)
            candidate_embeddings.append(embedding)
            accepted_images.append(raw)
        except Exception:
            continue

    if not candidate_embeddings:
        message = "no usable live face detected in uploaded images"
        if spoof_rejected > 0:
            message = "spoof face detected: image/photo faces are not allowed for registration"
        return JSONResponse({"error": message}, status_code=400)

    liveness_ok, liveness_error = evaluate_registration_liveness(
        total_face_frames=len(registration_spoof_scores),
        live_frame_count=len(candidate_embeddings),
        spoof_scores=registration_spoof_scores,
        eye_motion_values=eye_motion_values,
        signatures=registration_signatures,
    )
    if not liveness_ok:
        return JSONResponse({"error": liveness_error}, status_code=400)

    duplicate_match = find_duplicate_face_owner(candidate_embeddings)
    if duplicate_match is not None:
        matched_student_id, score = duplicate_match
        matched_student = get_student_row(matched_student_id)
        return JSONResponse(
            {
                "error": "face already belongs to another student",
                "matched_student_id": matched_student_id,
                "matched_student_name": matched_student[1] if matched_student else None,
                "similarity": round(score, 4),
            },
            status_code=409,
        )

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    now = datetime.datetime.utcnow().isoformat()
    c.execute(
        "INSERT INTO students (name, roll, class, section, enrollment_no, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (name, roll, class_name, sec, enrollment_no, now),
    )
    sid = c.lastrowid
    conn.commit()
    conn.close()

    folder = DATASET_DIR / str(sid)
    folder.mkdir(exist_ok=True)
    saved = 0
    for image_bytes in accepted_images:
        try:
            fname = f"{datetime.datetime.utcnow().timestamp():.6f}_{saved}.jpg"
            path = folder / fname
            with open(path, "wb") as out_file:
                out_file.write(image_bytes)
            saved += 1
        except Exception:
            continue
    if saved == 0:
        try:
            folder.rmdir()
        except OSError:
            pass
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("DELETE FROM students WHERE id=?", (sid,))
        conn.commit()
        conn.close()
        return JSONResponse({"error": "failed to save captured images"}, status_code=500)
    model_updated = True
    model_update_error = None
    try:
        upsert_student_embedding_profile(sid, candidate_embeddings)
    except Exception as exc:
        model_updated = False
        model_update_error = str(exc)

    return {
        "saved": saved,
        "skipped_similar_frames": skipped_similar_frames,
        "spoof_rejected": spoof_rejected,
        "processed_embeddings": len(candidate_embeddings),
        "student_id": sid,
        "model_updated": model_updated,
        "model_update_error": model_update_error,
    }


@app.post("/check_face_duplicate")
async def check_face_duplicate(image: UploadFile = File(...)):
    raw = await image.read()
    try:
        embedding_items = extract_embeddings_for_image(raw)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)
    if not embedding_items:
        return {"duplicate": False, "face_detected": False}
    live_items = [item for item in embedding_items if item.get("is_live", True)]
    if not live_items:
        return JSONResponse(
            {
                "duplicate": False,
                "face_detected": True,
                "is_live": False,
                "error": "spoof face detected: please use a real, live face in front of the camera",
            },
            status_code=400,
        )
    duplicate_match = find_duplicate_face_owner([live_items[0]["embedding"]])
    if duplicate_match is None:
        return {"duplicate": False, "face_detected": True}
    matched_student_id, score = duplicate_match
    matched_student = get_student_row(matched_student_id)
    return JSONResponse(
        {
            "duplicate": True,
            "face_detected": True,
            "matched_student_id": matched_student_id,
            "matched_student_name": matched_student[1] if matched_student else None,
            "similarity": round(score, 4),
        },
        status_code=409,
    )


@app.get("/train_model")
def train_model_route():
    status = read_train_status()
    if status.get("running"):
        return JSONResponse({"status": "already_running"}, status_code=202)
    write_train_status({"running": True, "progress": 0, "message": "Starting training"})
    t = threading.Thread(target=train_model_worker, daemon=True)
    t.start()
    return JSONResponse({"status": "started"}, status_code=202)


@app.get("/train_status")
def train_status():
    return read_train_status()


@app.get("/mark_attendance", response_class=HTMLResponse)
def mark_attendance_page(request: Request):
    return templates.TemplateResponse(name="mark_attendance.html", context={"request": request})


@app.post("/recognize_faces")
async def recognize_faces(image: UploadFile = File(...)):
    raw = await image.read()
    try:
        embedding_items = extract_embeddings_for_image(raw)
        if not embedding_items:
            return {"recognized": [], "face_count": 0, "error": "no faces detected"}
        live_items = [item for item in embedding_items if item.get("is_live", True)]
        spoof_count = len(embedding_items) - len(live_items)
        if not live_items:
            return {
                "recognized": [],
                "face_count": len(embedding_items),
                "live_face_count": 0,
                "spoof_count": spoof_count,
                "error": "spoof face detected: image/photo faces are not allowed",
            }
        clf = load_model_if_exists()
        if clf is None:
            return {
                "recognized": [],
                "face_count": len(embedding_items),
                "live_face_count": len(live_items),
                "spoof_count": spoof_count,
                "error": "model not trained",
            }
        np_buf = np.frombuffer(raw, np.uint8)
        bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
        return process_frame_embeddings(embedding_items, source_key="browser", frame_bgr=bgr)
    except Exception as exc:
        return JSONResponse({"recognized": [], "error": str(exc)}, status_code=500)


@app.post("/recognize_face")
async def recognize_face(image: UploadFile = File(...)):
    return JSONResponse(
        {
            "recognized": False,
            "error": "single-image attendance is disabled for security; use live camera scan endpoint /recognize_faces",
        },
        status_code=400,
    )


@app.post("/cctv/start")
async def start_cctv(request: Request):
    global cctv_thread

    with cctv_lock:
        if cctv_state["running"]:
            return JSONResponse({"status": "already_running"}, status_code=202)

    payload = {}
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        payload = dict(form)
    raw_source = payload.get("source", "0")
    source_value, source_label = normalize_source(raw_source)

    cctv_stop_event.clear()
    cctv_thread = threading.Thread(target=run_cctv_scanner, args=(source_value, source_label), daemon=True)
    cctv_thread.start()
    return JSONResponse({"status": "started", "source": source_label}, status_code=202)


@app.post("/cctv/stop")
def stop_cctv():
    cctv_stop_event.set()
    set_cctv_state(message="Stopping scanner...")
    return JSONResponse({"status": "stopping"}, status_code=202)


@app.get("/cctv/status")
def cctv_status():
    with cctv_lock:
        return dict(cctv_state)


@app.get("/attendance_record", response_class=HTMLResponse)
def attendance_record(request: Request, period: str = "all"):
    rows = build_attendance_rows(period)
    return templates.TemplateResponse(
        name="attendance_record.html",
        context={"request": request, "records": rows, "period": period},
    )


@app.get("/attendance_records")
def attendance_records(period: str = "all"):
    rows = build_attendance_rows(period)
    data = [
        {
            "roll": roll,
            "enrollment_no": enrollment_no,
            "name": name,
            "timestamp_ist": timestamp_ist,
        }
        for roll, enrollment_no, name, timestamp_ist in rows
    ]
    return {"period": period, "records": data}


@app.get("/download_csv")
def download_csv():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        SELECT
            COALESCE(s.roll, ds.roll) AS roll,
            COALESCE(s.enrollment_no, ds.enrollment_no) AS enrollment_no,
            a.name,
            a.timestamp
        FROM attendance a
        LEFT JOIN students s ON s.id = a.student_id
        LEFT JOIN deleted_students ds ON ds.original_student_id = a.student_id
        ORDER BY a.timestamp DESC
        """
    )
    rows = []
    ist_offset = datetime.timedelta(hours=5, minutes=30)
    for roll, enrollment_no, name, timestamp in c.fetchall():
        display_ts = timestamp
        try:
            utc_dt = datetime.datetime.fromisoformat(timestamp)
            ist_dt = utc_dt + ist_offset
            display_ts = ist_dt.strftime("%Y-%m-%d %I:%M:%S %p")
        except (TypeError, ValueError):
            pass
        rows.append((roll or "-", enrollment_no or "-", name, display_ts))
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["roll_number", "enrollment_number", "name", "timestamp_ist"])
    writer.writerows(rows)
    mem = io.BytesIO(output.getvalue().encode("utf-8"))
    mem.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="attendance.csv"'}
    return StreamingResponse(mem, media_type="text/csv", headers=headers)


@app.get("/students")
def students_list():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, enrollment_no, roll, class, section, created_at FROM students ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    data = [
        {
            "id": r[0],
            "name": r[1],
            "enrollment_no": r[2],
            "roll": r[3],
            "class": r[4],
            "section": r[5],
            "created_at": r[6],
        }
        for r in rows
    ]
    return {"students": data}


@app.delete("/students/{sid}")
def delete_student(sid: int):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, name, enrollment_no, roll, class, section, created_at FROM students WHERE id=?",
        (sid,),
    )
    student_row = c.fetchone()
    if student_row is None:
        conn.close()
        return JSONResponse({"error": "student not found"}, status_code=404)

    deleted_at = datetime.datetime.utcnow().isoformat()
    c.execute(
        """
        INSERT INTO deleted_students (
            original_student_id, name, enrollment_no, roll, class, section, created_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(original_student_id) DO UPDATE SET
            name=excluded.name,
            enrollment_no=excluded.enrollment_no,
            roll=excluded.roll,
            class=excluded.class,
            section=excluded.section,
            created_at=excluded.created_at,
            deleted_at=excluded.deleted_at
        """,
        (
            student_row[0],
            student_row[1],
            student_row[2],
            student_row[3],
            student_row[4],
            student_row[5],
            student_row[6],
            deleted_at,
        ),
    )
    c.execute("DELETE FROM students WHERE id=?", (sid,))
    conn.commit()
    conn.close()
    folder = DATASET_DIR / str(sid)
    if folder.is_dir():
        shutil.rmtree(folder, ignore_errors=True)
    model_updated = True
    model_update_error = None
    try:
        remove_student_embedding_profile(sid)
    except Exception as exc:
        model_updated = False
        model_update_error = str(exc)
    return {
        "deleted": True,
        "archived": True,
        "attendance_preserved": True,
        "model_updated": model_updated,
        "model_update_error": model_update_error,
    }
