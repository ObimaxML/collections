"""ledger source unique

Revision ID: a1912608c39c
Revises: c56e3b18756a
Create Date: 2026-08-30 18:35:19.261393

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a1912608c39c'
down_revision: Union[str, None] = 'c56e3b18756a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_financial_transactions_source",
        "financial_transactions",
        ["source_type", "source_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_financial_transactions_source",
        table_name="financial_transactions",
    )
