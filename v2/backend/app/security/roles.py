from app.domain.enums import Role

# Company management is strictly downwards; permissions never widen tenant scope.
ROLE_HIERARCHY: tuple[Role, ...] = (
    Role.SUPER_ADMIN,
    Role.COMPANY_ADMIN,
    Role.BOD,
    Role.HR,
    Role.EMPLOYEE,
)
EMPLOYEE_ROLES = (Role.BOD, Role.HR, Role.EMPLOYEE)
ADMIN_ROLES = (Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BOD, Role.HR)


def is_employee_role(role: Role) -> bool:
    return role in EMPLOYEE_ROLES


def can_manage_role(caller_role: Role, target_role: Role) -> bool:
    if caller_role not in ROLE_HIERARCHY or target_role not in ROLE_HIERARCHY:
        return False
    return caller_role == Role.SUPER_ADMIN or (
        ROLE_HIERARCHY.index(caller_role) < ROLE_HIERARCHY.index(target_role)
    )


def get_manageable_roles(caller_role: Role) -> tuple[Role, ...]:
    return tuple(role for role in ROLE_HIERARCHY if can_manage_role(caller_role, role))
