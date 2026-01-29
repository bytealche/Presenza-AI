from fastapi import Depends, HTTPException, status
from app.core.auth_dependencies import get_current_user
from app.models.user import User


def require_roles(allowed_roles: list[int]):
    def role_checker(user: User = Depends(get_current_user)):
        if user.role_id not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return user

    return role_checker
