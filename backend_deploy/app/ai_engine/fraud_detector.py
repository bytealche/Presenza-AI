def detect_fraud(is_live, confidence, threshold):
    if not is_live:
        return True, "liveness_failed"
    if confidence < threshold:
        return True, "low_confidence"
    return False, None
