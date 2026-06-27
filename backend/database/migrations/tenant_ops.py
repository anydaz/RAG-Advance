"""
Helpers for migrations that need to run DDL against every tenant schema.

Usage in a migration:

    from database.migrations.tenant_ops import for_each_tenant

    def upgrade() -> None:
        def up(slug):
            op.execute(text(f"CREATE TABLE {slug}.foo (...)"))

        for_each_tenant(up)

    def downgrade() -> None:
        def down(slug):
            op.execute(text(f"DROP TABLE IF EXISTS {slug}.foo"))

        for_each_tenant(down)
"""

from sqlalchemy import text  # noqa: F401 — re-exported so callers can use it
from alembic import op  # noqa: F401 — re-exported for convenience


def for_each_tenant(fn):
    """
    Fetches all organisation slugs and calls fn(slug) for each one.
    fn receives the slug string and is expected to call op.execute / op.* directly.
    """
    from database import SessionLocal
    from database.models import Organization

    db = SessionLocal()
    try:
        slugs = [org.slug for org in db.query(Organization).all()]
    finally:
        db.close()

    for slug in slugs:
        fn(slug)
