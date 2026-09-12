"""Add competency profile resources, provenance, and catalog constraints.

Revision ID: 0008_profile_resources
Revises: 0007_core_profile_roster
"""

import sqlalchemy as sa

from alembic import op

revision = "0008_profile_resources"
down_revision = "0007_core_profile_roster"
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


def _provenance_columns() -> list[sa.Column[object]]:
    return [
        sa.Column("source_type", sa.String(16), nullable=False),
        sa.Column("source_import_id", sa.Uuid(), nullable=True),
        sa.Column("proposal_item_id", sa.Uuid(), nullable=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    ]


def _scope_constraints(prefix: str) -> list[sa.Constraint]:
    return [
        sa.ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name=f"fk_{prefix}_user_company",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_import_id", "user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name=f"fk_{prefix}_import_scope",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["proposal_item_id", "source_import_id", "user_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.profile_import_id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name=f"fk_{prefix}_proposal_scope",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "source_import_id", "proposal_item_id", name=f"uq_{prefix}_import_item"
        ),
        sa.CheckConstraint("version > 0", name=f"ck_{prefix}_version_positive"),
        sa.CheckConstraint(
            "(source_type = 'IMPORT' AND source_import_id IS NOT NULL AND proposal_item_id IS NOT NULL) OR "
            "(source_type IN ('SELF', 'ADMIN') AND source_import_id IS NULL AND proposal_item_id IS NULL)",
            name=f"ck_{prefix}_provenance",
        ),
    ]


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_employments_scope", "employments", ["id", "user_id", "company_id"]
    )
    op.create_index("ix_employments_user", "employments", ["user_id"])
    op.create_table(
        "skills",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("normalized_key", sa.String(120), nullable=False),
        sa.Column("category", sa.String(80), nullable=True),
        *_timestamps(),
        sa.UniqueConstraint("normalized_key", name="uq_skills_normalized_key"),
        sa.CheckConstraint("length(normalized_key) > 0", name="ck_skills_normalized_key_nonempty"),
    )
    op.create_table(
        "employee_skills",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column(
            "skill_id", sa.Uuid(), sa.ForeignKey("skills.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(1000), nullable=True),
        sa.Column("self_assessed", sa.Boolean(), nullable=False),
        *_provenance_columns(),
        *_timestamps(),
        *_scope_constraints("employee_skills"),
        sa.UniqueConstraint("user_id", "skill_id", name="uq_employee_skills_user_skill"),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_employee_skills_rating"),
    )
    op.create_index("ix_employee_skills_company_user", "employee_skills", ["company_id", "user_id"])
    op.create_index("ix_employee_skills_user", "employee_skills", ["user_id"])

    op.create_table(
        "experiences",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("employment_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("organization", sa.String(180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        *_provenance_columns(),
        *_timestamps(),
        *_scope_constraints("experiences"),
        sa.ForeignKeyConstraint(
            ["employment_id", "user_id", "company_id"],
            ["employments.id", "employments.user_id", "employments.company_id"],
            name="fk_experiences_employment_scope",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="ck_experiences_dates",
        ),
    )
    op.create_index("ix_experiences_company_user", "experiences", ["company_id", "user_id"])
    op.create_index("ix_experiences_user", "experiences", ["user_id"])

    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("employment_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("role", sa.String(180), nullable=False),
        sa.Column("domain", sa.String(180), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tech_stack", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("contribution", sa.Text(), nullable=True),
        sa.Column("url", sa.String(2048), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        *_provenance_columns(),
        *_timestamps(),
        *_scope_constraints("projects"),
        sa.ForeignKeyConstraint(
            ["employment_id", "user_id", "company_id"],
            ["employments.id", "employments.user_id", "employments.company_id"],
            name="fk_projects_employment_scope",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="ck_projects_dates",
        ),
    )
    op.create_index("ix_projects_company_user", "projects", ["company_id", "user_id"])
    op.create_index("ix_projects_user", "projects", ["user_id"])

    op.create_table(
        "certifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("issuer", sa.String(180), nullable=False),
        sa.Column("score", sa.String(120), nullable=True),
        sa.Column("credential_url", sa.String(2048), nullable=True),
        sa.Column("issued_at", sa.Date(), nullable=True),
        sa.Column("expires_at", sa.Date(), nullable=True),
        *_provenance_columns(),
        *_timestamps(),
        *_scope_constraints("certifications"),
        sa.CheckConstraint(
            "expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at",
            name="ck_certifications_dates",
        ),
    )
    op.create_index("ix_certifications_company_user", "certifications", ["company_id", "user_id"])
    op.create_index("ix_certifications_user", "certifications", ["user_id"])

    op.create_table(
        "awards",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("type", sa.String(16), nullable=False),
        sa.Column("issuer", sa.String(180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("evidence_url", sa.String(2048), nullable=True),
        sa.Column("awarded_at", sa.Date(), nullable=True),
        sa.Column("self_reported", sa.Boolean(), nullable=False),
        *_provenance_columns(),
        *_timestamps(),
        *_scope_constraints("awards"),
    )
    op.create_index("ix_awards_company_user", "awards", ["company_id", "user_id"])
    op.create_index("ix_awards_user", "awards", ["user_id"])


def downgrade() -> None:
    for table in ("awards", "certifications", "projects", "experiences", "employee_skills"):
        op.drop_index(f"ix_{table}_user", table_name=table, if_exists=True)
        op.drop_index(f"ix_{table}_company_user", table_name=table)
        op.drop_table(table)
    op.drop_index("ix_employments_user", table_name="employments", if_exists=True)
    op.drop_table("skills")
    op.drop_constraint("uq_employments_scope", "employments", type_="unique")
