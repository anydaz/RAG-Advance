"""move_documents_to_tenant_schemas

Revision ID: f30c93f508b0
Revises: 57616a36747d
Create Date: 2026-06-27 10:21:39.062916

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from database.migrations.tenant_ops import for_each_tenant, text


# revision identifiers, used by Alembic.
revision: str = 'f30c93f508b0'
down_revision: Union[str, None] = '57616a36747d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    def up(slug):
        op.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {slug}.documents (
                id SERIAL PRIMARY KEY,
                org_slug VARCHAR NOT NULL,
                filename VARCHAR NOT NULL,
                r2_key VARCHAR NOT NULL,
                status VARCHAR NOT NULL DEFAULT 'processing',
                chunk_count INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        op.execute(text(f"""
            INSERT INTO {slug}.documents (id, org_slug, filename, r2_key, status, chunk_count, created_at)
            SELECT id, org_slug, filename, r2_key, status, chunk_count, created_at
            FROM public.documents
            WHERE org_slug = '{slug}'
        """))
        op.execute(text(f"""
            SELECT setval('{slug}.documents_id_seq', COALESCE((SELECT MAX(id) FROM {slug}.documents), 0) + 1, false)
        """))

    for_each_tenant(up)

    op.drop_index('ix_public_documents_org_slug', table_name='documents', schema='public')
    op.drop_table('documents', schema='public')


def downgrade() -> None:
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_slug', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('r2_key', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('chunk_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['org_slug'], ['public.organizations.slug'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='public',
    )
    op.create_index('ix_public_documents_org_slug', 'documents', ['org_slug'], schema='public')

    def down(slug):
        op.execute(text(f"""
            INSERT INTO public.documents (id, org_slug, filename, r2_key, status, chunk_count, created_at)
            SELECT id, org_slug, filename, r2_key, status, chunk_count, created_at
            FROM {slug}.documents
        """))
        op.execute(text(f"DROP TABLE IF EXISTS {slug}.documents"))

    for_each_tenant(down)
