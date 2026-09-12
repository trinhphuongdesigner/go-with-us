"""Add tenant-scoped source intake and profile imports.

Revision ID: 0006_profile_import_intake
Revises: 0005_login_rate_limits
"""

import sqlalchemy as sa

from alembic import op

revision = "0006_profile_import_intake"
down_revision = "0005_login_rate_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "source_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("byte_size > 0", name="ck_source_documents_byte_size_positive"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_source_documents_owner_company",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "owner_user_id", "company_id", "sha256", name="uq_source_documents_owner_sha256"
        ),
        sa.UniqueConstraint("id", "owner_user_id", "company_id", name="uq_source_documents_scope"),
    )
    op.create_index("ix_source_documents_company_id", "source_documents", ["company_id"])

    op.create_table(
        "source_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_source_versions_version_positive"),
        sa.ForeignKeyConstraint(["document_id"], ["source_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["document_id", "owner_user_id", "company_id"],
            [
                "source_documents.id",
                "source_documents.owner_user_id",
                "source_documents.company_id",
            ],
            name="fk_source_versions_document_scope",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id", "version", name="uq_source_versions_document_version"),
        sa.UniqueConstraint(
            "id", "document_id", "owner_user_id", "company_id", name="uq_source_versions_scope"
        ),
    )
    op.create_table(
        "source_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_version_id", sa.Uuid(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("text_sha256", sa.String(length=64), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=False),
        sa.Column("char_end", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("sheet_name", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("char_end > char_start", name="ck_source_blocks_char_span"),
        sa.CheckConstraint("char_start >= 0", name="ck_source_blocks_char_start_nonnegative"),
        sa.CheckConstraint("ordinal >= 0", name="ck_source_blocks_ordinal_nonnegative"),
        sa.ForeignKeyConstraint(["source_version_id"], ["source_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_version_id", "ordinal", name="uq_source_blocks_version_ordinal"
        ),
        sa.UniqueConstraint("id", "source_version_id", name="uq_source_blocks_id_version"),
    )
    op.create_index("ix_source_blocks_source_version_id", "source_blocks", ["source_version_id"])

    op.create_table(
        "profile_imports",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("source_document_id", sa.Uuid(), nullable=False),
        sa.Column("source_version_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("proposal_version", sa.Integer(), nullable=False),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("last_ai_status", sa.String(length=32), nullable=True),
        sa.Column("last_ai_warnings", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("last_clarification_questions", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("last_ai_trace_id", sa.Uuid(), nullable=True),
        sa.Column("last_prompt_version", sa.String(length=100), nullable=True),
        sa.Column("last_schema_version", sa.String(length=100), nullable=True),
        sa.Column("last_ai_model", sa.String(length=100), nullable=True),
        sa.Column("processing_token", sa.Uuid(), nullable=True),
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "proposal_version >= 0", name="ck_profile_imports_proposal_version_nonnegative"
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'PARSED', 'APPLIED', 'FAILED')",
            name="ck_profile_imports_status",
        ),
        sa.CheckConstraint("version > 0", name="ck_profile_imports_version_positive"),
        sa.CheckConstraint(
            "(status = 'PROCESSING' AND processing_token IS NOT NULL "
            "AND processing_started_at IS NOT NULL) OR "
            "(status <> 'PROCESSING' AND processing_token IS NULL "
            "AND processing_started_at IS NULL)",
            name="ck_profile_imports_processing_lease",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_profile_imports_owner_company",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_document_id", "owner_user_id", "company_id"],
            [
                "source_documents.id",
                "source_documents.owner_user_id",
                "source_documents.company_id",
            ],
            name="fk_profile_imports_document_scope",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_version_id", "source_document_id", "owner_user_id", "company_id"],
            [
                "source_versions.id",
                "source_versions.document_id",
                "source_versions.owner_user_id",
                "source_versions.company_id",
            ],
            name="fk_profile_imports_version_scope",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_version_id", name="uq_profile_imports_source_version"),
        sa.UniqueConstraint("id", "owner_user_id", "company_id", name="uq_profile_imports_scope"),
    )
    op.create_index("ix_profile_imports_company_id", "profile_imports", ["company_id"])

    op.create_table(
        "profile_proposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_import_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("trace_id", sa.Uuid(), nullable=False),
        sa.Column("prompt_version", sa.String(length=100), nullable=False),
        sa.Column("schema_version", sa.String(length=100), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version > 0", name="ck_profile_proposals_version_positive"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["profile_import_id", "owner_user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_profile_proposals_import_scope",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "id",
            "profile_import_id",
            "owner_user_id",
            "company_id",
            name="uq_profile_proposals_scope",
        ),
        sa.UniqueConstraint(
            "profile_import_id", "version", name="uq_profile_proposals_import_version"
        ),
    )
    op.create_index(
        "ix_profile_proposals_profile_import_id", "profile_proposals", ["profile_import_id"]
    )
    op.create_table(
        "profile_proposed_values",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("proposal_id", sa.Uuid(), nullable=False),
        sa.Column("profile_import_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("field_name", sa.String(length=40), nullable=False),
        sa.Column("value", sa.String(length=160), nullable=True),
        sa.Column("support_status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("field_name = 'jobTitle'", name="ck_profile_proposed_values_field"),
        sa.CheckConstraint(
            "support_status IN ('SUPPORTED', 'AMBIGUOUS', 'MISSING')",
            name="ck_profile_proposed_values_support_status",
        ),
        sa.ForeignKeyConstraint(
            ["proposal_id", "profile_import_id", "owner_user_id", "company_id"],
            [
                "profile_proposals.id",
                "profile_proposals.profile_import_id",
                "profile_proposals.owner_user_id",
                "profile_proposals.company_id",
            ],
            name="fk_profile_proposed_values_proposal_scope",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("proposal_id", "field_name", name="uq_profile_proposed_values_field"),
        sa.UniqueConstraint(
            "id",
            "profile_import_id",
            "owner_user_id",
            "company_id",
            name="uq_profile_proposed_values_scope",
        ),
        sa.UniqueConstraint(
            "id", "owner_user_id", "company_id", name="uq_profile_proposed_values_owner_scope"
        ),
    )
    op.create_index(
        "ix_profile_proposed_values_proposal_id", "profile_proposed_values", ["proposal_id"]
    )
    op.create_table(
        "profile_evidence_refs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("proposed_value_id", sa.Uuid(), nullable=False),
        sa.Column("subject_id", sa.Uuid(), nullable=False),
        sa.Column("source_document_id", sa.Uuid(), nullable=False),
        sa.Column("source_version_id", sa.Uuid(), nullable=False),
        sa.Column("source_block_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=False),
        sa.Column("char_end", sa.Integer(), nullable=False),
        sa.Column("quote", sa.String(length=800), nullable=False),
        sa.Column("quote_sha256", sa.String(length=64), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("sheet_name", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("char_end > char_start", name="ck_profile_evidence_refs_char_span"),
        sa.CheckConstraint("char_start >= 0", name="ck_profile_evidence_refs_char_start"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["proposed_value_id", "subject_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_profile_evidence_refs_proposed_value_scope",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["source_block_id"], ["source_blocks.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["source_block_id", "source_version_id"],
            ["source_blocks.id", "source_blocks.source_version_id"],
            name="fk_profile_evidence_refs_block_version",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_document_id"], ["source_documents.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["source_version_id"], ["source_versions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["source_version_id", "source_document_id", "subject_id", "company_id"],
            [
                "source_versions.id",
                "source_versions.document_id",
                "source_versions.owner_user_id",
                "source_versions.company_id",
            ],
            name="fk_profile_evidence_refs_source_scope",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["subject_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "proposed_value_id",
            "source_block_id",
            "char_start",
            "char_end",
            name="uq_profile_evidence_refs_span",
        ),
    )
    op.create_index(
        "ix_profile_evidence_refs_proposed_value_id", "profile_evidence_refs", ["proposed_value_id"]
    )
    op.create_table(
        "profile_field_provenance",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("profile_import_id", sa.Uuid(), nullable=False),
        sa.Column("proposed_value_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("field_name", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("field_name = 'jobTitle'", name="ck_profile_field_provenance_field"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["profile_import_id", "user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_profile_field_provenance_import_scope",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["proposed_value_id", "profile_import_id", "user_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.profile_import_id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_profile_field_provenance_value_scope",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["actor_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_profile_field_provenance_actor_company",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "profile_import_id", "proposed_value_id", name="uq_profile_field_provenance_import_item"
        ),
    )
    op.create_table(
        "profile_apply_receipts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("command_id", sa.Uuid(), nullable=False),
        sa.Column("profile_import_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key_hash", sa.String(length=64), nullable=False),
        sa.Column("request_digest", sa.String(length=64), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["profile_import_id", "owner_user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_profile_apply_receipts_import_scope",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("command_id"),
        sa.UniqueConstraint(
            "owner_user_id",
            "company_id",
            "idempotency_key_hash",
            name="uq_profile_apply_receipts_owner_key",
        ),
    )


def downgrade() -> None:
    op.drop_table("profile_apply_receipts")
    op.drop_table("profile_field_provenance")
    op.drop_index("ix_profile_evidence_refs_proposed_value_id", table_name="profile_evidence_refs")
    op.drop_table("profile_evidence_refs")
    op.drop_index("ix_profile_proposed_values_proposal_id", table_name="profile_proposed_values")
    op.drop_table("profile_proposed_values")
    op.drop_index("ix_profile_proposals_profile_import_id", table_name="profile_proposals")
    op.drop_table("profile_proposals")
    op.drop_index("ix_profile_imports_company_id", table_name="profile_imports")
    op.drop_table("profile_imports")
    op.drop_index("ix_source_blocks_source_version_id", table_name="source_blocks")
    op.drop_table("source_blocks")
    op.drop_table("source_versions")
    op.drop_index("ix_source_documents_company_id", table_name="source_documents")
    op.drop_table("source_documents")
