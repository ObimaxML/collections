"""add saas subscription model and deployment type to tenants

Revision ID: c491a1829e01
Revises: f38902d5e71c
Create Date: 2026-08-31 08:26:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c491a1829e01'
down_revision = 'f38902d5e71c'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'tenants',
        sa.Column('engagement_model', sa.String(50), nullable=False, server_default='MANAGED_SERVICE')
        # MANAGED_SERVICE (Molmos Managed Debt Recovery Agency), SAAS_SELF_SERVICE (Internal Municipal Subscription)
    )
    op.add_column(
        'tenants',
        sa.Column('subscription_tier', sa.String(50), nullable=False, server_default='ENTERPRISE')
        # STARTER, PROFESSIONAL, ENTERPRISE, OUTSOURCED_COMMISSION
    )
    op.add_column(
        'tenants',
        sa.Column('commission_rate', sa.Numeric(precision=5, scale=2), nullable=True, server_default='10.00')
        # Commission % for Molmos managed debt recovery (e.g. 10.00%)
    )
    op.add_column(
        'tenants',
        sa.Column('monthly_subscription_fee', sa.Numeric(precision=12, scale=2), nullable=True, server_default='0.00')
        # Monthly SaaS license fee in ZAR
    )
    op.add_column(
        'tenants',
        sa.Column('subscription_status', sa.String(50), nullable=False, server_default='ACTIVE')
        # ACTIVE, TRIAL, SUSPENDED, EXPIRED
    )
    op.add_column(
        'tenants',
        sa.Column('billing_contact_email', sa.String(255), nullable=True)
    )
    op.add_column(
        'tenants',
        sa.Column('contract_start_date', sa.Date(), nullable=True)
    )
    op.add_column(
        'tenants',
        sa.Column('contract_end_date', sa.Date(), nullable=True)
    )


def downgrade():
    op.drop_column('tenants', 'contract_end_date')
    op.drop_column('tenants', 'contract_start_date')
    op.drop_column('tenants', 'billing_contact_email')
    op.drop_column('tenants', 'subscription_status')
    op.drop_column('tenants', 'monthly_subscription_fee')
    op.drop_column('tenants', 'commission_rate')
    op.drop_column('tenants', 'subscription_tier')
    op.drop_column('tenants', 'engagement_model')
