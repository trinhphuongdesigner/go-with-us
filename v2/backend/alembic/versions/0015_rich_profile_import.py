"""Persist owner-scoped rich import proposals and exactly-once apply receipts."""

import sqlalchemy as sa

from alembic import op

revision = "0015_rich_profile_import"
down_revision = "0014_organization"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "rich_profile_imports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("encrypted_sources", sa.Text(), nullable=False),
        sa.Column("source_labels", sa.JSON(), nullable=False),
        sa.Column("proposal", sa.JSON(), nullable=False),
        sa.Column("snapshot_hash", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("applied", sa.Boolean(), nullable=False),
        sa.Column("identity_warning", sa.Boolean(), nullable=False),
        sa.Column("applied_request_id", sa.Uuid()),
        sa.Column("applied_hash", sa.String(64)),
        sa.Column("applied_counts", sa.JSON()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_rich_import_owner_company",
        ),
    )
    op.create_index(
        "ix_rich_profile_imports_owner_user_id", "rich_profile_imports", ["owner_user_id"]
    )


def downgrade():
    op.drop_table("rich_profile_imports")
