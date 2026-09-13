"""Add optimistic-lock versioning to career goals."""

import sqlalchemy as sa

from alembic import op

revision = "0018_career_goal_version"
down_revision = "0017_role_default_grants"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "career_goals",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_check_constraint(
        "ck_career_goal_version_positive",
        "career_goals",
        "version >= 1",
    )


def downgrade():
    raise RuntimeError("Career goal versions protect concurrent edits; use a reviewed forward migration")
