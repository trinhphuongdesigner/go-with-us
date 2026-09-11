from app.domain.enums import AdminPermission, Permission, Role
from app.domain.models import User

_SELF_SERVICE_PERMISSIONS = frozenset(
    {
        Permission.DASHBOARD_READ,
        Permission.PROFILE_SELF,
        Permission.ROADMAP_SELF,
        Permission.ASSESSMENT_SELF,
    }
)

_ADMIN_PERMISSION_MAP: dict[AdminPermission, Permission] = {
    AdminPermission.COMPANY_READ: Permission.COMPANY_READ,
    AdminPermission.COMPANY_WRITE: Permission.COMPANY_MANAGE,
    AdminPermission.EMPLOYEE_READ: Permission.PEOPLE_READ,
    AdminPermission.EMPLOYEE_WRITE: Permission.PEOPLE_WRITE,
    AdminPermission.ASSESSMENT_REVIEW: Permission.ASSESSMENT_REVIEW,
    AdminPermission.PASSPORT_APPROVE: Permission.PASSPORT_APPROVE,
}

_SUPER_ADMIN_PERMISSIONS = frozenset(Permission)


def effective_permissions(user: User) -> set[Permission]:
    """Project stored permission identifiers through a closed, typed mapping."""
    if not user.is_active:
        return set()
    if user.role == Role.SUPER_ADMIN:
        return set(_SUPER_ADMIN_PERMISSIONS)

    result = set(_SELF_SERVICE_PERMISSIONS)
    if user.role != Role.COMPANY_ADMIN:
        return result

    for raw_permission in user.admin_permissions:
        try:
            admin_permission = AdminPermission(raw_permission)
        except ValueError:
            continue
        mapped = _ADMIN_PERMISSION_MAP.get(admin_permission)
        if mapped is not None:
            result.add(mapped)
    return result
