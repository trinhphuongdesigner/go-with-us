"""Career goals, immutable plan history and encrypted provider/conversation storage."""

from alembic import op
import sqlalchemy as sa

revision = "0012_career_ai"
down_revision = "0011_profile_extensions"
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


def owner(company_nullable=False):
    return [
        sa.Column("owner_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "company_id", sa.Uuid(), sa.ForeignKey("companies.id"), nullable=company_nullable
        ),
    ]


def upgrade():
    op.create_table(
        "career_ai_connections",
        sa.Column("provider", sa.String(20), primary_key=True),
        sa.Column("encrypted_key", sa.Text(), nullable=False),
        sa.Column("base_url", sa.String(500)),
        sa.Column("model", sa.String(150)),
        *timestamps(),
    )
    op.create_table(
        "career_goals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *owner(),
        sa.Column(
            "roadmap_id",
            sa.Uuid(),
            sa.ForeignKey("development_roadmaps.id", ondelete="SET NULL"),
            unique=True,
        ),
        sa.Column("category", sa.String(8), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("metric", sa.String(500)),
        sa.Column("target_value", sa.Float()),
        sa.Column("current_value", sa.Float()),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.Date()),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("ai_suggested", sa.Boolean(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_career_goals_owner_user_id", "career_goals", ["owner_user_id"])
    op.create_index("ix_career_goals_company_id", "career_goals", ["company_id"])
    op.create_table(
        "career_plan_revisions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *owner(),
        sa.Column("category", sa.String(8), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("summary", sa.String(2000)),
        sa.Column("ai_generated", sa.Boolean(), nullable=False),
        sa.UniqueConstraint(
            "owner_user_id", "company_id", "category", "version", name="uq_career_plan_version"
        ),
        *timestamps(),
    )
    op.create_index(
        "ix_career_plan_revisions_owner_user_id", "career_plan_revisions", ["owner_user_id"]
    )
    op.create_table(
        "career_assistant_conversations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        *owner(True),
        sa.Column("context_company_id", sa.Uuid(), sa.ForeignKey("companies.id")),
        sa.Column("uses_roster", sa.Boolean(), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("focus", sa.String(10), nullable=False),
        sa.Column("category", sa.String(8), nullable=False),
        sa.Column("pinned", sa.Boolean(), nullable=False),
        *timestamps(),
    )
    op.create_index(
        "ix_career_assistant_conversations_owner_user_id",
        "career_assistant_conversations",
        ["owner_user_id"],
    )
    op.create_table(
        "career_assistant_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.Uuid(),
            sa.ForeignKey("career_assistant_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("referenced_user_ids", sa.JSON(), nullable=False),
        sa.Column("proposal_data", sa.JSON()),
        *timestamps(),
    )
    op.create_index(
        "ix_career_assistant_messages_conversation_id",
        "career_assistant_messages",
        ["conversation_id"],
    )


def downgrade():
    for table in [
        "career_assistant_messages",
        "career_assistant_conversations",
        "career_plan_revisions",
        "career_goals",
        "career_ai_connections",
    ]:
        op.drop_table(table)
