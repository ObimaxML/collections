"""add metadata json to municipal_accounts and customers

Revision ID: b74901f4c10a
Revises: e68a1f81d9b0
Create Date: 2026-08-30 21:57:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b74901f4c10a'
down_revision = 'e68a1f81d9b0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'municipal_accounts',
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}')
    )
    op.add_column(
        'customers',
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}')
    )


def downgrade():
    op.drop_column('customers', 'metadata')
    op.drop_column('municipal_accounts', 'metadata')
