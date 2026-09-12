from .auth import router as auth_router
from .people import router as people_router
from .profile import router as profile_router
from .profile_imports import router as profile_imports_router

__all__ = ["auth_router", "people_router", "profile_imports_router", "profile_router"]
