"""Company metadata and role grant configuration."""
import sqlalchemy as sa
from alembic import op

revision = "0014_organization"
down_revision = "0013_talent_workflows"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("company_details",
        sa.Column("company_id", sa.Uuid(), sa.ForeignKey("companies.id"), primary_key=True),
        sa.Column("industry", sa.String(180)))
    op.create_table("company_role_definitions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("company_id", sa.Uuid(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("role", sa.String(24), nullable=False),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "role", name="uq_company_role_definition"))


def downgrade():
    raise RuntimeError("Preserve configured role grants; use a forward migration")
