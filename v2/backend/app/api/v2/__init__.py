from .auth import router as auth_router
from .companies import router as companies_router
from .competency_profile import router as competency_profile_router
from .people import router as people_router
from .profile import router as profile_router
from .profile_imports import router as profile_imports_router
from .skills_competency import router as skills_competency_router

__all__ = [
    "auth_router",
    "companies_router",
    "competency_profile_router",
    "people_router",
    "profile_imports_router",
    "profile_router",
    "skills_competency_router",
]
