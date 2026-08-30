"""create user_tenants association table and user assigned_tenants

Revision ID: f38902d5e71c
Revises: b74901f4c10a
Create Date: 2026-08-30 22:16:30.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f38902d5e71c'
down_revision = 'b74901f4c10a'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'tenant_id', name='uq_user_tenants_user_tenant')
    )
    
    # Backfill existing user.tenant_id into user_tenants
    op.execute("""
        INSERT INTO user_tenants (id, user_id, tenant_id, created_at)
        SELECT gen_random_uuid(), id, tenant_id, NOW()
        FROM users
        WHERE tenant_id IS NOT NULL
        ON CONFLICT DO NOTHING;
    """)


def downgrade():
    op.drop_table('user_tenants')
