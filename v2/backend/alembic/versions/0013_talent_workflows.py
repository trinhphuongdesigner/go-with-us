"""Add scoped assessment history, passport snapshots and job requirements."""

import sqlalchemy as sa

from alembic import op

revision = "0013_talent_workflows"
down_revision = "0012_career_ai"
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    ]


def identifier(name="id", *, primary=False, nullable=False, foreign=None):
    return sa.Column(
        name,
        sa.Uuid(),
        *([sa.ForeignKey(foreign)] if foreign else []),
        primary_key=primary,
        nullable=nullable,
    )


def string(name, length=180, default=None):
    return sa.Column(name, sa.String(length), nullable=False, server_default=default)


def integer(name="version", default="1"):
    return sa.Column(name, sa.Integer(), nullable=False, server_default=default)


def json_column(name):
    return sa.Column(name, sa.JSON(), nullable=False)


def upgrade():
    op.create_table(
        "talent_assessment_templates",
        identifier(primary=True),
        identifier("company_id", foreign="companies.id"),
        identifier("created_by_id", foreign="users.id"),
        identifier("family_id"),
        integer(),
        string("name"),
        sa.Column("description", sa.Text(), nullable=False),
        string("status", 16, "DRAFT"),
        json_column("groups"),
        *timestamps(),
        sa.UniqueConstraint("id", "company_id", name="uq_talent_templates_company"),
        sa.UniqueConstraint("family_id", "version", name="uq_talent_templates_family_version"),
        sa.CheckConstraint(
            "status IN ('DRAFT','ACTIVE','ARCHIVED')", name="ck_talent_template_status"
        ),
    )
    op.create_table(
        "talent_assessment_cycles",
        identifier(primary=True),
        identifier("company_id"),
        identifier("template_id"),
        string("name"),
        string("period", 7),
        sa.Column("due_date", sa.Date(), nullable=True),
        string("status", 16, "OPEN"),
        integer(),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["template_id", "company_id"],
            ["talent_assessment_templates.id", "talent_assessment_templates.company_id"],
            name="fk_talent_cycle_template_company",
        ),
        sa.UniqueConstraint("id", "company_id", name="uq_talent_cycles_company"),
        sa.UniqueConstraint("company_id", "period", name="uq_talent_cycles_period"),
        sa.CheckConstraint("status IN ('OPEN','CLOSED')", name="ck_talent_cycle_status"),
    )
    op.create_table(
        "talent_assessments",
        identifier(primary=True),
        identifier("company_id"),
        identifier("cycle_id"),
        identifier("reviewee_id"),
        identifier("reviewer_id", foreign="users.id"),
        identifier("employment_id", nullable=True),
        string("type", 16),
        string("status", 16, "DRAFT"),
        integer(),
        json_column("template_snapshot"),
        json_column("answers"),
        string("mood", 80, ""),
        *[
            sa.Column(name, sa.Text(), nullable=False)
            for name in ("highlights", "comment", "review_comment")
        ],
        *[
            sa.Column(name, sa.Float(), nullable=True)
            for name in ("total_score", "contribution_score", "attitude_score")
        ],
        *[
            sa.Column(name, sa.DateTime(timezone=True), nullable=True)
            for name in ("submitted_at", "approved_at")
        ],
        identifier("approved_by_id", foreign="users.id", nullable=True),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["reviewee_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_talent_assessment_reviewee_company",
        ),
        sa.ForeignKeyConstraint(
            ["cycle_id", "company_id"],
            ["talent_assessment_cycles.id", "talent_assessment_cycles.company_id"],
            name="fk_talent_assessment_cycle_company",
        ),
        sa.ForeignKeyConstraint(
            ["employment_id", "reviewee_id", "company_id"],
            ["employments.id", "employments.user_id", "employments.company_id"],
            name="fk_talent_assessment_employment",
        ),
        sa.CheckConstraint("type IN ('SELF','PEER','MANAGER')", name="ck_talent_assessment_type"),
        sa.CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')",
            name="ck_talent_assessment_status",
        ),
    )
    op.create_table(
        "talent_career_summaries",
        identifier(primary=True),
        identifier("owner_user_id"),
        identifier("company_id"),
        identifier("employment_id", nullable=True),
        string("source", 32, "PERSONAL"),
        string("status", 16, "DRAFT"),
        integer(),
        sa.Column("content", sa.Text(), nullable=False),
        json_column("strengths"),
        json_column("growth_areas"),
        sa.Column("evaluation", sa.Text(), nullable=False),
        json_column("dimension_scores"),
        *[
            sa.Column(name, sa.DateTime(timezone=True), nullable=True)
            for name in ("generated_at", "approved_at")
        ],
        identifier("approved_by_id", foreign="users.id", nullable=True),
        json_column("snapshot"),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_talent_summary_owner_company",
        ),
        sa.ForeignKeyConstraint(
            ["employment_id", "owner_user_id", "company_id"],
            ["employments.id", "employments.user_id", "employments.company_id"],
            name="fk_talent_summary_employment",
        ),
        sa.UniqueConstraint("id", "owner_user_id", "company_id", name="uq_talent_summary_scope"),
        sa.CheckConstraint("status IN ('DRAFT','APPROVED')", name="ck_talent_summary_status"),
        sa.CheckConstraint(
            "source IN ('PERSONAL','ORGANIZATION_OFFBOARDING')", name="ck_talent_summary_source"
        ),
    )
    op.create_table(
        "talent_passport_shares",
        identifier(primary=True),
        identifier("owner_user_id"),
        identifier("company_id"),
        identifier("summary_id"),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        string("label", 180, ""),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        json_column("snapshot"),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["summary_id", "owner_user_id", "company_id"],
            [
                "talent_career_summaries.id",
                "talent_career_summaries.owner_user_id",
                "talent_career_summaries.company_id",
            ],
            name="fk_talent_share_summary_scope",
        ),
    )
    op.create_table(
        "talent_job_requirements",
        identifier(primary=True),
        identifier("company_id", foreign="companies.id"),
        identifier("created_by_id", foreign="users.id"),
        string("title"),
        sa.Column("description", sa.Text(), nullable=False),
        json_column("required_skills"),
        string("status", 16, "open"),
        integer(),
        *timestamps(),
        sa.CheckConstraint("status IN ('open','closed')", name="ck_talent_requirement_status"),
    )
    for table, columns in {
        "talent_assessment_templates": ["company_id"],
        "talent_assessment_cycles": ["company_id"],
        "talent_assessments": ["company_id", "reviewee_id", "reviewer_id"],
        "talent_career_summaries": ["owner_user_id", "company_id"],
        "talent_passport_shares": ["owner_user_id"],
        "talent_job_requirements": ["company_id"],
    }.items():
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade():
    raise RuntimeError("Talent history contains user data; use a reviewed forward migration")
