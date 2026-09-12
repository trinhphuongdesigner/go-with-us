"""Persist scoped roadmap attempts, ordered tasks and separate display settings.

Revision ID: 0010_development_plans
Revises: 0009_role_hierarchy
"""

import sqlalchemy as sa

from alembic import op

revision = "0010_development_plans"
down_revision = "0009_role_hierarchy"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column[object]]:
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "development_roadmaps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("client_request_id", sa.Uuid(), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("category", sa.String(8), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("duration_weeks", sa.Integer(), nullable=True),
        sa.Column("hours_per_week", sa.Integer(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_roadmaps_owner_company",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "owner_user_id", "company_id", "client_request_id", name="uq_roadmaps_request"
        ),
        sa.CheckConstraint("category IN ('WORK', 'PERSONAL')", name="ck_roadmaps_category"),
        sa.CheckConstraint("version > 0", name="ck_roadmaps_version"),
        sa.CheckConstraint("length(trim(title)) > 0", name="ck_roadmaps_title"),
        sa.CheckConstraint(
            "duration_weeks IS NULL OR duration_weeks BETWEEN 1 AND 520",
            name="ck_roadmaps_duration",
        ),
        sa.CheckConstraint(
            "hours_per_week IS NULL OR hours_per_week BETWEEN 1 AND 168", name="ck_roadmaps_hours"
        ),
    )
    op.create_index(
        "ix_roadmaps_owner_category",
        "development_roadmaps",
        ["owner_user_id", "company_id", "category", "created_at"],
    )
    op.create_table(
        "development_milestones",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "roadmap_id",
            sa.Uuid(),
            sa.ForeignKey("development_roadmaps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.UniqueConstraint("roadmap_id", "order", name="uq_milestones_order"),
        sa.CheckConstraint('"order" >= 0', name="ck_milestones_order"),
        sa.CheckConstraint("length(trim(title)) > 0", name="ck_milestones_title"),
    )
    op.create_table(
        "development_tasks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "milestone_id",
            sa.Uuid(),
            sa.ForeignKey("development_milestones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("metric", sa.String(500), nullable=True),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.UniqueConstraint("milestone_id", "order", name="uq_development_tasks_order"),
        sa.CheckConstraint('"order" >= 0', name="ck_development_tasks_order"),
        sa.CheckConstraint("length(trim(title)) > 0", name="ck_development_tasks_title"),
    )
    op.create_table(
        "development_plan_settings",
        sa.Column("owner_user_id", sa.Uuid(), primary_key=True),
        sa.Column("company_id", sa.Uuid(), primary_key=True),
        sa.Column("display_settings", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_development_settings_owner_company",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("version > 0", name="ck_development_settings_version"),
    )


def downgrade() -> None:
    raise RuntimeError("Roadmap attempts contain user data; use a reviewed forward migration")
