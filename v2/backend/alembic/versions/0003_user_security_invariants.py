"""Enforce canonical user identity and tenant-role invariants.

Revision ID: 0003_user_security_invariants
Revises: 0002_user_profile_fields

CareerMate v2 migrations target PostgreSQL. Tests use SQLAlchemy metadata on
SQLite for fast behavioral feedback rather than executing this migration.
"""

import sqlalchemy as sa

from alembic import op

revision = "0003_user_security_invariants"
down_revision = "0002_user_profile_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_users_role_company",
        "users",
        "(role = 'SUPER_ADMIN' AND company_id IS NULL) OR "
        "(role IN ('COMPANY_ADMIN', 'EMPLOYEE') AND company_id IS NOT NULL)",
    )
    op.create_check_constraint(
        "ck_users_email_canonical",
        "users",
        "email = lower(trim(email))",
    )
    op.drop_index("ix_users_email", table_name="users")
    op.create_index(
        "uq_users_email_lower",
        "users",
        [sa.text("lower(email)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_users_email_lower", table_name="users")
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.drop_constraint("ck_users_email_canonical", "users", type_="check")
    op.drop_constraint("ck_users_role_company", "users", type_="check")
