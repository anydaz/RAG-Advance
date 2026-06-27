"""create_tenant_users_table

Revision ID: 8ddff4af3de4
Revises: 8a651de8a972
Create Date: 2026-06-25 16:33:52.094848

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from database.migrations.tenant_ops import for_each_tenant, text


# revision identifiers, used by Alembic.
revision: str = '8ddff4af3de4'
down_revision: Union[str, None] = '8a651de8a972'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    def up(slug):
        op.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {slug}.users (
                id SERIAL PRIMARY KEY,
                username VARCHAR NOT NULL UNIQUE,
                hashed_password VARCHAR NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))

    for_each_tenant(up)


def downgrade() -> None:
    for_each_tenant(lambda slug: op.execute(text(f"DROP TABLE IF EXISTS {slug}.users")))
