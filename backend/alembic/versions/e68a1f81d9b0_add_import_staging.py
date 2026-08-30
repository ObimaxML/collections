"""add import staging tables

Revision ID: e68a1f81d9b0
Revises: a1912608c39c
Create Date: 2026-08-30

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "e68a1f81d9b0"
down_revision = "a1912608c39c"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "import_batches",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "file_name",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "source_type",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
        ),
        sa.Column(
            "total_rows",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "valid_rows",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "invalid_rows",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "imported_rows",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_by",
            sa.String(150),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_table(
        "import_rows",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "batch_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("import_batches.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "row_number",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "account_number",
            sa.String(100),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "transaction_type",
            sa.String(50),
            nullable=True,
        ),
        sa.Column(
            "transaction_date",
            sa.Date(),
            nullable=True,
        ),
        sa.Column(
            "amount",
            sa.Numeric(14, 2),
            nullable=True,
        ),
        sa.Column(
            "reference",
            sa.String(255),
            nullable=True,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "source_type",
            sa.String(100),
            nullable=True,
        ),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
        ),
        sa.Column(
            "validation_error",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "financial_transaction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "financial_transactions.id"
            ),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_import_rows_batch_row",
        "import_rows",
        ["batch_id", "row_number"],
        unique=True,
    )

    op.create_index(
        "ix_import_rows_source",
        "import_rows",
        [
            "tenant_id",
            "source_type",
            "source_id",
        ],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_import_rows_source",
        table_name="import_rows",
    )

    op.drop_index(
        "ix_import_rows_batch_row",
        table_name="import_rows",
    )

    op.drop_table("import_rows")
    op.drop_table("import_batches")
