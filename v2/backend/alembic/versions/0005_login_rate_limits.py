"""Add shared opaque login rate-limit counters.

Revision ID: 0005_login_rate_limits
Revises: 0004_tenant_auth_sessions
"""

import sqlalchemy as sa

from alembic import op

revision = "0005_login_rate_limits"
down_revision = "0004_tenant_auth_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_rate_limits",
        sa.Column("bucket_key", sa.String(length=72), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "attempts > 0",
            name="ck_login_rate_limits_attempts_positive",
        ),
        sa.PrimaryKeyConstraint("bucket_key"),
    )
    op.create_index(
        "ix_login_rate_limits_window_started_at",
        "login_rate_limits",
        ["window_started_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_login_rate_limits_window_started_at",
        table_name="login_rate_limits",
    )
    op.drop_table("login_rate_limits")
