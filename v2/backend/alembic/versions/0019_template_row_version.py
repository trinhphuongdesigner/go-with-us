"""Separate assessment template content revision from optimistic row version."""

import sqlalchemy as sa

from alembic import op

revision = "0019_template_row_version"
down_revision = "0018_career_goal_version"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "talent_assessment_templates",
        sa.Column("row_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_check_constraint(
        "ck_talent_template_row_version_positive",
        "talent_assessment_templates",
        "row_version >= 1",
    )


def downgrade():
    raise RuntimeError(
        "Template row versions protect concurrent lifecycle changes; use a reviewed forward migration"
    )
