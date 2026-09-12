"""Add display fields required by the authenticated application shell.

Revision ID: 0002_user_profile_fields
Revises: 0001_initial
"""

import sqlalchemy as sa

from alembic import op

revision = "0002_user_profile_fields"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("name", sa.String(length=160), nullable=False, server_default="CareerMate User"),
    )
    op.add_column("users", sa.Column("job_title", sa.String(length=160), nullable=True))
    op.alter_column("users", "name", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "job_title")
    op.drop_column("users", "name")
