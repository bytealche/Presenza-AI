from app.ai_engine.vector_store import find_match

def recognize_face(embedding):
    user_id, confidence = find_match(embedding)
    return user_id, confidence
