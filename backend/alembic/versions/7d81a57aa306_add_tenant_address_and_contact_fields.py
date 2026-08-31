"""add_tenant_address_and_contact_fields

Revision ID: 7d81a57aa306
Revises: d823e5910f14
Create Date: 2026-08-31 11:41:52.686892

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7d81a57aa306'
down_revision: Union[str, None] = 'd823e5910f14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('physical_address', sa.String(length=500), nullable=True))
    op.add_column('tenants', sa.Column('postal_address', sa.String(length=500), nullable=True))
    op.add_column('tenants', sa.Column('contact_person', sa.String(length=255), nullable=True))
    op.add_column('tenants', sa.Column('contact_position', sa.String(length=255), nullable=True))
    op.add_column('tenants', sa.Column('contact_phone', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'contact_phone')
    op.drop_column('tenants', 'contact_position')
    op.drop_column('tenants', 'contact_person')
    op.drop_column('tenants', 'postal_address')
    op.drop_column('tenants', 'physical_address')
