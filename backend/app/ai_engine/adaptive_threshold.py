def adjust_threshold(base_threshold, confidence):
    if confidence > 0.9:
        return base_threshold - 0.1
    if confidence < 0.6:
        return base_threshold + 0.1
    return base_threshold
