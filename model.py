import os
import pickle
import cv2
import numpy as np

MODEL_PATH = "face_embeddings.pkl"
MODEL_NAME = "buffalo_l"
MODEL_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".insightface")
DETECTION_SIZE = (640, 640)
_FACE_ANALYZER = None
SPOOF_SCORE_THRESHOLD = 0.58
FAR_FACE_UPSCALE_FACTOR = 1.8
FAR_FACE_UPSCALE_MAX_WIDTH = 1920
FAR_FACE_UPSCALE_MAX_HEIGHT = 1080

# Canonical 3D anchors (arbitrary face model units) aligned with 5-point landmarks:
# left_eye, right_eye, nose, mouth_left, mouth_right
FACE_3D_MODEL_POINTS = np.array(
    [
        [-30.0, 32.0, -30.0],
        [30.0, 32.0, -30.0],
        [0.0, 0.0, 0.0],
        [-24.0, -28.0, -20.0],
        [24.0, -28.0, -20.0],
    ],
    dtype=np.float32,
)


def normalize_embedding(embedding):
    emb = np.asarray(embedding, dtype=np.float32)
    norm = np.linalg.norm(emb)
    if norm == 0:
        return None
    return emb / norm


def ensure_runtime_dependencies():
    try:
        import insightface  # noqa: F401
        import onnxruntime  # noqa: F401
    except ModuleNotFoundError as exc:
        package = exc.name or "insightface"
        raise RuntimeError(
            "Missing runtime dependency "
            f"'{package}'. Install 'insightface' and 'onnxruntime' before training or recognition."
        ) from exc


def get_face_analyzer():
    global _FACE_ANALYZER
    if _FACE_ANALYZER is not None:
        return _FACE_ANALYZER

    ensure_runtime_dependencies()
    from insightface.app import FaceAnalysis

    _FACE_ANALYZER = FaceAnalysis(
        name=MODEL_NAME,
        root=MODEL_ROOT,
        providers=["CPUExecutionProvider"],
    )
    _FACE_ANALYZER.prepare(ctx_id=-1, det_size=DETECTION_SIZE)
    return _FACE_ANALYZER


def sort_faces(faces):
    def face_area(face):
        bbox = getattr(face, "bbox", None)
        if bbox is None:
            return 0.0
        return float((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]))

    return sorted(faces, key=face_area, reverse=True)


def estimate_spoof_score(bgr_image, bbox):
    if bgr_image is None or bbox is None:
        return 1.0

    h, w = bgr_image.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    x1 = max(0, min(x1, w - 1))
    y1 = max(0, min(y1, h - 1))
    x2 = max(x1 + 1, min(x2, w))
    y2 = max(y1 + 1, min(y2, h))
    roi = bgr_image[y1:y2, x1:x2]
    if roi.size == 0:
        return 1.0
    if roi.shape[0] < 32 or roi.shape[1] < 32:
        # Tiny crops have unstable texture statistics; treat as borderline risky.
        return 0.55

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray_f = gray.astype(np.float32)
    lap_var = float(cv2.Laplacian(gray_f, cv2.CV_32F).var())
    intensity_std = float(np.std(gray_f))
    gx = cv2.Sobel(gray_f, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray_f, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.sqrt(gx * gx + gy * gy)
    grad_mean = float(np.mean(grad_mag))

    # Simple 8-neighbor LBP for micro-texture richness.
    c = gray_f[1:-1, 1:-1]
    lbp = (
        ((gray_f[:-2, :-2] >= c).astype(np.uint8) << 7)
        | ((gray_f[:-2, 1:-1] >= c).astype(np.uint8) << 6)
        | ((gray_f[:-2, 2:] >= c).astype(np.uint8) << 5)
        | ((gray_f[1:-1, 2:] >= c).astype(np.uint8) << 4)
        | ((gray_f[2:, 2:] >= c).astype(np.uint8) << 3)
        | ((gray_f[2:, 1:-1] >= c).astype(np.uint8) << 2)
        | ((gray_f[2:, :-2] >= c).astype(np.uint8) << 1)
        | (gray_f[1:-1, :-2] >= c).astype(np.uint8)
    )
    lbp_hist = np.bincount(lbp.ravel(), minlength=256).astype(np.float32)
    lbp_hist /= max(float(lbp_hist.sum()), 1.0)
    lbp_entropy = float(-np.sum(lbp_hist * np.log2(lbp_hist + 1e-8)) / 8.0)

    # High-frequency content ratio from FFT magnitude spectrum.
    spectrum = np.fft.fftshift(np.fft.fft2(gray_f))
    mag = np.log1p(np.abs(spectrum))
    hh, ww = mag.shape
    cy, cx = hh // 2, ww // 2
    low_h = max(2, int(hh * 0.12))
    low_w = max(2, int(ww * 0.12))
    low_mask = np.zeros_like(mag, dtype=bool)
    low_mask[max(0, cy - low_h):min(hh, cy + low_h), max(0, cx - low_w):min(ww, cx + low_w)] = True
    total_energy = float(np.mean(mag))
    high_energy = float(np.mean(mag[~low_mask])) if np.any(~low_mask) else 0.0
    high_freq_ratio = high_energy / (total_energy + 1e-6)

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    sat_mean = float(np.mean(hsv[:, :, 1]))
    bright_ratio = float(np.mean(gray > 245))
    ycrcb = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
    chroma_std = float(0.5 * (np.std(ycrcb[:, :, 1]) + np.std(ycrcb[:, :, 2])))

    # Normalize texture cues into [0, 1] spoof-risk components.
    blur_risk = np.clip((120.0 - lap_var) / 120.0, 0.0, 1.0)
    weak_gradient_risk = np.clip((16.0 - grad_mean) / 16.0, 0.0, 1.0)
    flat_texture_risk = np.clip((34.0 - intensity_std) / 34.0, 0.0, 1.0)
    low_lbp_entropy_risk = np.clip((0.72 - lbp_entropy) / 0.72, 0.0, 1.0)
    low_high_freq_risk = np.clip((1.02 - high_freq_ratio) / 0.24, 0.0, 1.0)
    low_chroma_risk = np.clip((18.0 - chroma_std) / 18.0, 0.0, 1.0)
    low_saturation_risk = np.clip((40.0 - sat_mean) / 40.0, 0.0, 1.0)
    glare_risk = np.clip((bright_ratio - 0.045) / 0.16, 0.0, 1.0)

    score = (
        0.21 * blur_risk
        + 0.13 * weak_gradient_risk
        + 0.18 * flat_texture_risk
        + 0.16 * low_lbp_entropy_risk
        + 0.16 * low_high_freq_risk
        + 0.06 * low_chroma_risk
        + 0.05 * low_saturation_risk
        + 0.05 * glare_risk
    )
    return float(np.clip(score, 0.0, 1.0))


def estimate_3d_consistency_risk(kps, image_shape):
    if kps is None:
        return 0.5
    try:
        image_points = np.asarray(kps, dtype=np.float32)
        if image_points.shape != (5, 2):
            return 0.5
        h, w = image_shape[:2]
        focal = float(max(w, h))
        camera_matrix = np.array(
            [[focal, 0.0, w / 2.0], [0.0, focal, h / 2.0], [0.0, 0.0, 1.0]],
            dtype=np.float32,
        )
        dist_coeffs = np.zeros((4, 1), dtype=np.float32)

        ok, rvec, tvec = cv2.solvePnP(
            FACE_3D_MODEL_POINTS,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not ok:
            return 0.8

        projected, _ = cv2.projectPoints(FACE_3D_MODEL_POINTS, rvec, tvec, camera_matrix, dist_coeffs)
        projected = projected.reshape(-1, 2)
        reproj_err = np.linalg.norm(projected - image_points, axis=1)
        eye_dist = float(np.linalg.norm(image_points[1] - image_points[0]))
        if eye_dist <= 1e-6:
            return 0.8

        normalized_err = float(np.mean(reproj_err) / eye_dist)
        # Relaxed mapping to avoid rejecting genuine classroom faces at distance/angle.
        return float(np.clip((normalized_err - 0.06) / 0.16, 0.0, 1.0))
    except Exception:
        return 0.5


def estimate_scale_risk(kps):
    if kps is None:
        return 0.5
    try:
        points = np.asarray(kps, dtype=np.float32)
        if points.shape != (5, 2):
            return 0.5
        eye_dist = float(np.linalg.norm(points[1] - points[0]))
        # Very soft penalty so distant students are still eligible for liveness.
        return float(np.clip((10.0 - eye_dist) / 10.0, 0.0, 1.0))
    except Exception:
        return 0.5


def face_to_embedding_item(face, bgr_image=None):
    bbox = tuple(int(v) for v in np.asarray(face.bbox).tolist())
    embedding = normalize_embedding(face.embedding)
    if embedding is None:
        return None
    kps = getattr(face, "kps", None)
    keypoints = None
    if kps is not None:
        try:
            keypoints = np.asarray(kps, dtype=np.float32).tolist()
        except Exception:
            keypoints = None
    texture_risk = estimate_spoof_score(bgr_image, bbox)
    pnp_risk = estimate_3d_consistency_risk(keypoints, bgr_image.shape if bgr_image is not None else (0, 0, 0))
    scale_risk = estimate_scale_risk(keypoints)
    spoof_score = float(np.clip(0.70 * texture_risk + 0.20 * pnp_risk + 0.10 * scale_risk, 0.0, 1.0))
    return {
        "bbox": bbox,
        "embedding": embedding,
        "kps": keypoints,
        "det_score": float(getattr(face, "det_score", 0.0)),
        "texture_risk": texture_risk,
        "pnp_risk": pnp_risk,
        "scale_risk": scale_risk,
        "spoof_score": spoof_score,
        "is_live": bool(spoof_score < SPOOF_SCORE_THRESHOLD),
    }


def read_bgr_image(stream_or_bytes):
    if hasattr(stream_or_bytes, "read"):
        data = stream_or_bytes.read()
    else:
        data = stream_or_bytes
    arr = np.frombuffer(data, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def extract_embeddings_for_bgr_image(bgr_image):
    if bgr_image is None:
        return []
    analyzer = get_face_analyzer()
    faces = sort_faces(analyzer.get(bgr_image))

    # Fallback for distant/small faces: run one pass on an upscaled frame,
    # then map landmarks and boxes back to original coordinates.
    if not faces:
        h, w = bgr_image.shape[:2]
        scale = FAR_FACE_UPSCALE_FACTOR
        up_w = int(w * scale)
        up_h = int(h * scale)
        if up_w > FAR_FACE_UPSCALE_MAX_WIDTH or up_h > FAR_FACE_UPSCALE_MAX_HEIGHT:
            scale_w = FAR_FACE_UPSCALE_MAX_WIDTH / max(1, w)
            scale_h = FAR_FACE_UPSCALE_MAX_HEIGHT / max(1, h)
            scale = max(1.0, min(scale_w, scale_h))
        if scale > 1.01:
            upscaled = cv2.resize(
                bgr_image,
                (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_CUBIC,
            )
            up_faces = sort_faces(analyzer.get(upscaled))
            adjusted_faces = []
            for face in up_faces:
                try:
                    face.bbox = np.asarray(face.bbox, dtype=np.float32) / scale
                    if getattr(face, "kps", None) is not None:
                        face.kps = np.asarray(face.kps, dtype=np.float32) / scale
                except Exception:
                    pass
                adjusted_faces.append(face)
            faces = adjusted_faces

    embeddings = []
    for face in faces:
        item = face_to_embedding_item(face, bgr_image=bgr_image)
        if item is not None:
            embeddings.append(item)
    return embeddings


def extract_embeddings_for_image(stream_or_bytes):
    img = read_bgr_image(stream_or_bytes)
    return extract_embeddings_for_bgr_image(img)


def extract_embedding_for_image(stream_or_bytes):
    embeddings = extract_embeddings_for_image(stream_or_bytes)
    if not embeddings:
        return None
    return embeddings[0]["embedding"]


def load_model_if_exists():
    if not os.path.exists(MODEL_PATH):
        return None
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def predict_with_model(model_data, emb):
    normalized = normalize_embedding(emb)
    if normalized is None:
        return None, 0.0
    students = model_data.get("students", {})
    best_label = None
    best_score = -1.0
    for student_id, student_data in students.items():
        reference = student_data.get("mean_embedding")
        if reference is None:
            continue
        score = float(np.dot(normalized, reference))
        if score > best_score:
            best_label = int(student_id)
            best_score = score
    confidence = (best_score + 1.0) / 2.0 if best_label is not None else 0.0
    return best_label, confidence


def build_student_embedding_model(embeddings_by_student):
    students = {}
    for sid, embeddings in embeddings_by_student.items():
        if not embeddings:
            continue
        matrix = np.stack(embeddings)
        mean_embedding = normalize_embedding(np.mean(matrix, axis=0))
        if mean_embedding is None:
            continue
        students[int(sid)] = {
            "mean_embedding": mean_embedding,
            "sample_count": int(matrix.shape[0]),
        }
    return {
        "model_type": "insightface_arcface_cosine",
        "model_name": MODEL_NAME,
        "students": students,
    }


def save_model_data(model_data):
    temp_path = f"{MODEL_PATH}.tmp"
    with open(temp_path, "wb") as f:
        pickle.dump(model_data, f)
    os.replace(temp_path, MODEL_PATH)


def upsert_student_embedding_profile(student_id, embeddings):
    normalized_embeddings = []
    for embedding in embeddings:
        normalized = normalize_embedding(embedding)
        if normalized is not None:
            normalized_embeddings.append(normalized)
    if not normalized_embeddings:
        raise ValueError("No usable embeddings to update model")

    matrix = np.stack(normalized_embeddings)
    mean_embedding = normalize_embedding(np.mean(matrix, axis=0))
    if mean_embedding is None:
        raise ValueError("Unable to compute student mean embedding")

    model_data = load_model_if_exists()
    if not isinstance(model_data, dict):
        model_data = {}
    students = model_data.get("students")
    if not isinstance(students, dict):
        students = {}

    students[int(student_id)] = {
        "mean_embedding": mean_embedding,
        "sample_count": int(matrix.shape[0]),
    }
    model_data["model_type"] = "insightface_arcface_cosine"
    model_data["model_name"] = MODEL_NAME
    model_data["students"] = students
    save_model_data(model_data)
    return model_data


def remove_student_embedding_profile(student_id):
    model_data = load_model_if_exists()
    if not isinstance(model_data, dict):
        return None
    students = model_data.get("students")
    if not isinstance(students, dict):
        return model_data
    students.pop(int(student_id), None)
    model_data["students"] = students
    save_model_data(model_data)
    return model_data


def train_model_background(dataset_dir, progress_callback=None):
    ensure_runtime_dependencies()

    embeddings_by_student = {}
    reused_students = {}
    existing_model = load_model_if_exists()
    existing_students = existing_model.get("students", {}) if isinstance(existing_model, dict) else {}
    existing_students_by_id = {}
    if isinstance(existing_students, dict):
        for sid_key, student_data in existing_students.items():
            try:
                sid_int = int(sid_key)
            except (TypeError, ValueError):
                continue
            if isinstance(student_data, dict):
                existing_students_by_id[sid_int] = student_data

    student_dirs = [d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))]
    total_students = max(1, len(student_dirs))
    processed = 0

    for sid in student_dirs:
        sid_int = int(sid)
        folder = os.path.join(dataset_dir, sid)
        files = [f for f in os.listdir(folder) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        cached = existing_students_by_id.get(sid_int)
        if (
            isinstance(cached, dict)
            and cached.get("mean_embedding") is not None
            and int(cached.get("sample_count", -1)) == len(files)
            and len(files) > 0
        ):
            reused_students[sid_int] = {
                "mean_embedding": cached["mean_embedding"],
                "sample_count": int(cached.get("sample_count", len(files))),
            }
            processed += 1
            if progress_callback:
                pct = int((processed / total_students) * 80)
                progress_callback(pct, f"Processed {processed}/{total_students} students")
            continue
        for fn in files:
            path = os.path.join(folder, fn)
            img = cv2.imread(path)
            if img is None:
                continue
            detections = extract_embeddings_for_bgr_image(img)
            if not detections:
                continue
            embeddings_by_student.setdefault(sid_int, []).append(detections[0]["embedding"])
        processed += 1
        if progress_callback:
            pct = int((processed / total_students) * 80)
            progress_callback(pct, f"Processed {processed}/{total_students} students")

    changed_model = build_student_embedding_model(embeddings_by_student)
    final_students = dict(reused_students)
    final_students.update(changed_model.get("students", {}))
    if not final_students:
        if progress_callback:
            progress_callback(0, "No usable face embeddings found")
        return

    model_data = {
        "model_type": "insightface_arcface_cosine",
        "model_name": MODEL_NAME,
        "students": final_students,
    }

    if progress_callback:
        progress_callback(90, "Saving student face embeddings...")
    save_model_data(model_data)

    if progress_callback:
        progress_callback(100, "Training complete")
