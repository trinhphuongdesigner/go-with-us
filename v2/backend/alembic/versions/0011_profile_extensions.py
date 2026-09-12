"""Private evidence, personal details, activity and exact-recipient HR requests."""

import sqlalchemy as sa
from alembic import op

revision = "0011_profile_extensions"
down_revision = "0010_development_plans"
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


def upgrade():
    op.create_table(
        "personal_details",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("avatar_asset_id", sa.Uuid()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        *timestamps(),
    )
    op.create_table(
        "stored_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(160), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_assets_owner_company",
        ),
    )
    op.create_table(
        "profile_activity_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("category", sa.String(80)),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("evidence_url", sa.String(2048)),
        sa.Column("evidence_asset_id", sa.Uuid(), sa.ForeignKey("stored_assets.id")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_activities_owner_company",
        ),
    )
    op.create_table(
        "competency_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sender_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("employment_id", sa.Uuid(), sa.ForeignKey("employments.id"), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("source_snapshot", sa.JSON(), nullable=False),
        sa.Column("client_request_id", sa.Uuid(), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("message", sa.Text()),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("points_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("review_note", sa.Text()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.ForeignKeyConstraint(
            ["sender_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_requests_sender_company",
        ),
        sa.ForeignKeyConstraint(
            ["recipient_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_requests_recipient_company",
        ),
        sa.UniqueConstraint("sender_id", "client_request_id", name="uq_competency_request_retry"),
    )
    op.create_index(
        "ix_requests_recipient_status",
        "competency_requests",
        ["recipient_id", "status", "created_at"],
    )
    op.create_index("ix_activities_owner_date", "profile_activity_logs", ["owner_user_id", "date"])


def downgrade():
    raise RuntimeError(
        "Profile evidence and HR decisions are user data; use a reviewed forward migration"
    )
