"""Backfill explicit company access without changing ownership or employment."""

import sqlalchemy as sa

from alembic import op

revision = "0016_company_memberships"
down_revision = "0015_rich_profile_import"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "company_memberships",
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "company_id",
            sa.Uuid(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_company_memberships_company", "company_memberships", ["company_id"])
    op.execute(
        sa.text(
            "INSERT INTO company_memberships (user_id, company_id) SELECT id, company_id FROM users WHERE company_id IS NOT NULL"
        )
    )
    # JSON arrays use SQLAlchemy's dialect encoding; only pure company admins receive the new grant.
    users = sa.table(
        "users",
        sa.column("id", sa.Uuid()),
        sa.column("role", sa.String()),
        sa.column("admin_permissions", sa.JSON()),
    )
    connection = op.get_bind()
    for row in connection.execute(
        sa.select(users.c.id, users.c.admin_permissions).where(users.c.role == "COMPANY_ADMIN")
    ):
        grants = list(row.admin_permissions or [])
        if "MANAGE_ROLES" not in grants:
            connection.execute(
                users.update()
                .where(users.c.id == row.id)
                .values(admin_permissions=[*grants, "MANAGE_ROLES"])
            )


def downgrade():
    raise RuntimeError("Membership grants are user data; use a reviewed forward migration")
