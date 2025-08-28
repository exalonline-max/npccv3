"""add uuid columns to key tables

Revision ID: 0002_add_uuid_columns
Revises: 0001_initial_schema
Create Date: 2025-08-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import uuid

# revision identifiers, used by Alembic.
revision = '0002_add_uuid_columns'
down_revision = '0001_initial_schema'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Add uuid columns as String(36) by default; Postgres can use native UUID if preferred.
    if dialect == 'postgresql':
        op.add_column('users', sa.Column('uuid', sa.String(length=36), nullable=True))
        op.create_index('ix_users_uuid', 'users', ['uuid'], unique=True)
        op.add_column('campaigns', sa.Column('uuid', sa.String(length=36), nullable=True))
        op.create_index('ix_campaigns_uuid', 'campaigns', ['uuid'], unique=True)
        op.add_column('memberships', sa.Column('uuid', sa.String(length=36), nullable=True))
        op.create_index('ix_memberships_uuid', 'memberships', ['uuid'], unique=True)
        op.add_column('characters', sa.Column('uuid', sa.String(length=36), nullable=True))
        op.create_index('ix_characters_uuid', 'characters', ['uuid'], unique=True)
    else:
        # generic: use string(36)
        op.add_column('users', sa.Column('uuid', sa.String(length=36), nullable=True))
        op.create_index('ix_users_uuid', 'users', ['uuid'], unique=True)
        op.add_column('campaigns', sa.Column('uuid', sa.String(length=36), nullable=True))
        op.create_index('ix_campaigns_uuid', 'campaigns', ['uuid'], unique=True)
        op.add_column('memberships', sa.Column('uuid', sa.String(length=36), nullable=True))
        op.create_index('ix_memberships_uuid', 'memberships', ['uuid'], unique=True)
        op.add_column('characters', sa.Column('uuid', sa.String(length=36), nullable=True))
        op.create_index('ix_characters_uuid', 'characters', ['uuid'], unique=True)

    # Backfill existing rows with generated UUIDs
    for table in ('users','campaigns','memberships','characters'):
        rows = bind.execute(sa.text(f"SELECT id FROM {table}"))
        for r in rows:
            new_uuid = str(uuid.uuid4())
            bind.execute(sa.text(f"UPDATE {table} SET uuid = :u WHERE id = :id"), {'u': new_uuid, 'id': r.id})


def downgrade():
    op.drop_index('ix_characters_uuid', table_name='characters')
    op.drop_column('characters', 'uuid')
    op.drop_index('ix_memberships_uuid', table_name='memberships')
    op.drop_column('memberships', 'uuid')
    op.drop_index('ix_campaigns_uuid', table_name='campaigns')
    op.drop_column('campaigns', 'uuid')
    op.drop_index('ix_users_uuid', table_name='users')
    op.drop_column('users', 'uuid')
