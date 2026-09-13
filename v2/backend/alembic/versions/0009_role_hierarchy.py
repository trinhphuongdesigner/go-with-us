"""Allow the five-role hierarchy without rewriting existing user data."""

from alembic import op

revision = "0009_role_hierarchy"
down_revision = "0008_profile_resources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_users_role_company", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role_company",
        "users",
        "(role = 'SUPER_ADMIN' AND company_id IS NULL) OR "
        "(role IN ('COMPANY_ADMIN', 'BOD', 'HR', 'EMPLOYEE') AND company_id IS NOT NULL)",
    )


def downgrade() -> None:
    # PostgreSQL validates this constraint before removing the wider one. If BOD/HR
    # rows exist, downgrade fails transactionally instead of coercing/deleting roles.
    op.create_check_constraint(
        "ck_users_role_company_legacy",
        "users",
        "(role = 'SUPER_ADMIN' AND company_id IS NULL) OR "
        "(role IN ('COMPANY_ADMIN', 'EMPLOYEE') AND company_id IS NOT NULL)",
    )
    op.drop_constraint("ck_users_role_company", "users", type_="check")
    op.execute(
        "ALTER TABLE users RENAME CONSTRAINT ck_users_role_company_legacy TO ck_users_role_company"
    )
