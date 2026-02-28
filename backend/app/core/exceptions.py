from fastapi import HTTPException, status

class BaseAPIException(HTTPException):
    """Base class for custom API exceptions."""
    def __init__(self, status_code: int, detail: str, headers: dict = None):
        super().__init__(status_code=status_code, detail=detail, headers=headers)

class DatabaseConflictError(BaseAPIException):
    def __init__(self, detail: str = "Database conflict error"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)

class ResourceNotFoundError(BaseAPIException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class FaceDetectionError(BaseAPIException):
    def __init__(self, detail: str = "No face detected or could not process face"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

class LivenessDetectionError(BaseAPIException):
    def __init__(self, detail: str = "Liveness check failed"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

class UnauthorizedAccessError(BaseAPIException):
    def __init__(self, detail: str = "Unauthorized access"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
