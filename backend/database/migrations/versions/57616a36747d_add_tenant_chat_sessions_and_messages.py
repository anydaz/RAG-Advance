"""add_tenant_chat_sessions_and_messages

Revision ID: 57616a36747d
Revises: 3681a0c72309
Create Date: 2026-06-27 10:19:43.826742

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from database.migrations.tenant_ops import for_each_tenant, text


# revision identifiers, used by Alembic.
revision: str = '57616a36747d'
down_revision: Union[str, None] = '3681a0c72309'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    def up(slug):
        op.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {slug}.chat_sessions (
                id SERIAL PRIMARY KEY,
                username VARCHAR NOT NULL,
                title VARCHAR NOT NULL DEFAULT 'New chat',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        op.execute(text(f"CREATE INDEX IF NOT EXISTS chat_sessions_username_idx ON {slug}.chat_sessions (username)"))
        op.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {slug}.chat_messages (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES {slug}.chat_sessions(id) ON DELETE CASCADE,
                role VARCHAR NOT NULL,
                content TEXT NOT NULL,
                sources TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        op.execute(text(f"CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON {slug}.chat_messages (session_id)"))

    for_each_tenant(up)


def downgrade() -> None:
    def down(slug):
        op.execute(text(f"DROP TABLE IF EXISTS {slug}.chat_messages"))
        op.execute(text(f"DROP TABLE IF EXISTS {slug}.chat_sessions"))

    for_each_tenant(down)
