"""add popia compliance consent and privacy framework

Revision ID: d823e5910f14
Revises: c491a1829e01
Create Date: 2026-08-31 08:48:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd823e5910f14'
down_revision = 'c491a1829e01'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add POPIA Consent and Privacy Attributes to Customer
    op.add_column(
        'customers',
        sa.Column('popia_consent_status', sa.String(50), nullable=False, server_default='CONSENTED')
        # CONSENTED, EXPLICIT_OPT_OUT, STATUTORY_COLLECTION, REJECTED
    )
    op.add_column(
        'customers',
        sa.Column('popia_consent_date', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'customers',
        sa.Column('popia_dnc_status', sa.Boolean(), nullable=False, server_default=sa.text('false'))
        # Do-Not-Contact / Stop Communications flag
    )
    op.add_column(
        'customers',
        sa.Column('data_retention_expiry', sa.Date(), nullable=True)
    )

    # 2. Add POPIA Processing Justification & Channel to ContactAttempts
    op.add_column(
        'contact_attempts',
        sa.Column('popia_lawful_basis', sa.String(100), nullable=True, server_default='MFMA_STATUTORY_REVENUE_RECOVERY')
    )

    # 3. Create Dedicated POPIA Privacy Requests / Audit Table
    op.create_table(
        'popia_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('request_type', sa.String(50), nullable=False),  # ACCESS_SUBJECT_DATA, RECTIFICATION, DELETION_OBJECTION, CONSENT_WITHDRAWAL, RESTRICTION
        sa.Column('status', sa.String(50), nullable=False, server_default='PENDING'), # PENDING, APPROVED, REJECTED, COMPLETED
        sa.Column('requester_name', sa.String(150), nullable=False),
        sa.Column('requester_email', sa.String(255), nullable=True),
        sa.Column('justification_notes', sa.Text(), nullable=True),
        sa.Column('actioned_by', sa.String(150), nullable=True),
        sa.Column('actioned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('popia_requests')
    op.drop_column('contact_attempts', 'popia_lawful_basis')
    op.drop_column('customers', 'data_retention_expiry')
    op.drop_column('customers', 'popia_dnc_status')
    op.drop_column('customers', 'popia_consent_date')
    op.drop_column('customers', 'popia_consent_status')
