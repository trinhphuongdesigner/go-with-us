"""Bind employment tenant ownership and add revocable authentication sessions.

Revision ID: 0004_tenant_auth_sessions
Revises: 0003_user_security_invariants

CareerMate v2 migrations target PostgreSQL. PostgreSQL integration tests verify
the composite tenant foreign key against the isolated careermate_v2_test DB.
"""

import sqlalchemy as sa

from alembic import op

revision = "0004_tenant_auth_sessions"
down_revision = "0003_user_security_invariants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_users_id_company_id",
        "users",
        ["id", "company_id"],
    )
    op.create_foreign_key(
        "fk_employments_user_company",
        "employments",
        "users",
        ["user_id", "company_id"],
        ["id", "company_id"],
        ondelete="RESTRICT",
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=True),
        sa.Column("jti_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_auth_sessions_user_company",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti_hash", name="uq_auth_sessions_jti_hash"),
    )
    op.create_index(
        "ix_auth_sessions_user_revoked",
        "auth_sessions",
        ["user_id", "revoked_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_user_revoked", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_constraint(
        "fk_employments_user_company",
        "employments",
        type_="foreignkey",
    )
    op.drop_constraint("uq_users_id_company_id", "users", type_="unique")
