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

    Uses the alembic connection (op.get_bind()) so it shares the same transaction
    context and always sees DDL committed by earlier migrations.
    """
    conn = op.get_bind()

    # Guard: organizations table may not exist on a brand-new database
    table_exists = conn.execute(text(
        "SELECT EXISTS ("
        "  SELECT 1 FROM information_schema.tables"
        "  WHERE table_schema = 'public' AND table_name = 'organizations'"
        ")"
    )).scalar()

    if not table_exists:
        return

    rows = conn.execute(text("SELECT slug FROM public.organizations"))
    slugs = [row[0] for row in rows]

    for slug in slugs:
        fn(slug)
