import uuid
from typing import cast

import pytest
from fastapi import HTTPException

from app.api.v2.auth import session_user
from app.api.v2.dependencies import require_permission
from app.domain.enums import AdminPermission, Permission, Role
from app.domain.models import User
from app.security.permissions import effective_permissions


def make_user(role: Role, admin_permissions: list[str] | None = None) -> User:
    return User(
        id=uuid.uuid4(),
        email=f"{role.value.casefold()}@example.dev",
        name=role.value,
        hashed_password="unused",
        role=role,
        company_id=None if role == Role.SUPER_ADMIN else uuid.uuid4(),
        admin_permissions=admin_permissions or [],
        is_active=True,
    )


def test_company_admin_has_no_implicit_company_manage_permission() -> None:
    user = make_user(Role.COMPANY_ADMIN)

    assert Permission.COMPANY_MANAGE not in effective_permissions(user)


def test_typed_admin_permission_mapping_ignores_unknown_database_values() -> None:
    user = make_user(
        Role.COMPANY_ADMIN,
        [AdminPermission.EMPLOYEE_READ.value, "invented:admin", "company:manage"],
    )

    assert effective_permissions(user) == {
        Permission.DASHBOARD_READ,
        Permission.PEOPLE_READ,
        Permission.ROLES_MANAGE,
    }


def test_permission_mapping_fails_closed_for_non_string_json_values() -> None:
    user = make_user(Role.COMPANY_ADMIN)
    user.admin_permissions = cast(list[str], [None, 7, {"permission": "COMPANY_WRITE"}])

    assert Permission.COMPANY_MANAGE not in effective_permissions(user)


def test_employee_cannot_gain_admin_permissions_from_database_column() -> None:
    user = make_user(Role.EMPLOYEE, [AdminPermission.COMPANY_WRITE.value])

    assert Permission.COMPANY_MANAGE not in effective_permissions(user)


def test_session_schema_keeps_permissions_typed() -> None:
    projected = session_user(make_user(Role.COMPANY_ADMIN, [AdminPermission.EMPLOYEE_READ.value]))

    assert projected.permissions == [
        Permission.DASHBOARD_READ,
        Permission.PEOPLE_READ,
        Permission.ROLES_MANAGE,
    ]


@pytest.mark.asyncio
async def test_permission_guard_denies_missing_permission() -> None:
    checker = require_permission(Permission.COMPANY_MANAGE)

    with pytest.raises(HTTPException) as error:
        await checker(make_user(Role.COMPANY_ADMIN))

    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_permission_guard_allows_explicit_permission() -> None:
    checker = require_permission(Permission.PEOPLE_WRITE)
    user = make_user(Role.COMPANY_ADMIN, [AdminPermission.EMPLOYEE_WRITE.value])

    assert await checker(user) is user
