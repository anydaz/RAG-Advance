"""add_parent_chunks_table

Revision ID: b4e9f1a2c3d5
Revises: f30c93f508b0
Create Date: 2026-06-28

"""
from typing import Sequence, Union
from alembic import op
from database.migrations.tenant_ops import for_each_tenant, text

revision: str = 'b4e9f1a2c3d5'
down_revision: Union[str, None] = 'f30c93f508b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    def up(slug):
        op.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {slug}.parent_chunks (
                id SERIAL PRIMARY KEY,
                document_id INTEGER NOT NULL
                    REFERENCES {slug}.documents(id) ON DELETE CASCADE,
                text TEXT NOT NULL
            )
        """))
        op.execute(text(f"""
            CREATE INDEX IF NOT EXISTS ix_{slug}_parent_chunks_document_id
            ON {slug}.parent_chunks (document_id)
        """))

    for_each_tenant(up)


def downgrade() -> None:
    def down(slug):
        op.execute(text(f"DROP TABLE IF EXISTS {slug}.parent_chunks"))

    for_each_tenant(down)
