"""Complete BOD and HR default workflow grants without overwriting custom roles."""

import sqlalchemy as sa

from alembic import op

revision = "0017_role_default_grants"
down_revision = "0016_company_memberships"
branch_labels = None
depends_on = None


_OLD_DEFAULTS = {
    "BOD": ["COMPANY_READ", "EMPLOYEE_READ", "PASSPORT_APPROVE"],
    "HR": ["COMPANY_READ", "EMPLOYEE_READ", "EMPLOYEE_WRITE", "ASSESSMENT_REVIEW"],
}
_NEW_DEFAULTS = {
    "BOD": [
        "COMPANY_READ",
        "EMPLOYEE_READ",
        "ASSESSMENT_REVIEW",
        "PASSPORT_APPROVE",
    ],
    "HR": [
        "COMPANY_READ",
        "EMPLOYEE_READ",
        "EMPLOYEE_WRITE",
        "ASSESSMENT_REVIEW",
        "PASSPORT_APPROVE",
    ],
}


def _same_grants(value, expected: list[str]) -> bool:
    grants = list(value or [])
    return len(grants) == len(expected) and set(grants) == set(expected)


def upgrade():
    definitions = sa.table(
        "company_role_definitions",
        sa.column("id", sa.Uuid()),
        sa.column("company_id", sa.Uuid()),
        sa.column("role", sa.String()),
        sa.column("permissions", sa.JSON()),
        sa.column("version", sa.Integer()),
    )
    users = sa.table(
        "users",
        sa.column("id", sa.Uuid()),
        sa.column("company_id", sa.Uuid()),
        sa.column("role", sa.String()),
        sa.column("admin_permissions", sa.JSON()),
    )
    connection = op.get_bind()
    upgraded_scopes: set[tuple[object, str]] = set()
    rows = connection.execute(
        sa.select(
            definitions.c.id,
            definitions.c.company_id,
            definitions.c.role,
            definitions.c.permissions,
        ).where(
            definitions.c.version == 1,
            definitions.c.role.in_(tuple(_OLD_DEFAULTS)),
        )
    )
    for row in rows:
        if not _same_grants(row.permissions, _OLD_DEFAULTS[row.role]):
            continue
        connection.execute(
            definitions.update()
            .where(definitions.c.id == row.id)
            .values(permissions=_NEW_DEFAULTS[row.role])
        )
        upgraded_scopes.add((row.company_id, row.role))

    for company_id, role in upgraded_scopes:
        accounts = connection.execute(
            sa.select(users.c.id, users.c.admin_permissions).where(
                users.c.company_id == company_id,
                users.c.role == role,
            )
        )
        for account in accounts:
            if _same_grants(account.admin_permissions, _OLD_DEFAULTS[role]):
                connection.execute(
                    users.update()
                    .where(users.c.id == account.id)
                    .values(admin_permissions=_NEW_DEFAULTS[role])
                )


def downgrade():
    raise RuntimeError("Role grants are authorization data; use a reviewed forward migration")
