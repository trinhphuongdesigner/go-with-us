"""Add optimistic profile version invariant and tenant roster index.

Revision ID: 0007_core_profile_roster
Revises: 0006_profile_import_intake
"""

from alembic import op

revision = "0007_core_profile_roster"
down_revision = "0006_profile_import_intake"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_users_version_positive",
        "users",
        "version > 0",
    )
    op.create_index(
        "ix_users_roster_scope",
        "users",
        ["company_id", "role", "is_active", "name", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_users_roster_scope", table_name="users")
    op.drop_constraint("ck_users_version_positive", "users", type_="check")
