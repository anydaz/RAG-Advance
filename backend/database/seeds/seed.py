"""Seed demo orgs and users. Safe to run multiple times."""
import sys
import os

# Ensure backend/ root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from database import SessionLocal, tenant_session
from repositories import org_repository, user_repository
import tenant as tenant_utils
import auth

ORGS = [
    {"slug": "acme", "display_name": "Acme Corp"},
    {"slug": "globex", "display_name": "Globex Inc"},
]

USERS = [
    {"org_slug": "acme", "username": "alice", "password": "password123"},
    {"org_slug": "acme", "username": "bob", "password": "secret456"},
    {"org_slug": "globex", "username": "carol", "password": "globex789"},
]

db = SessionLocal()

for o in ORGS:
    if not org_repository.find_by_slug(o["slug"], db):
        org_repository.create(o["slug"], o["display_name"], db)
        tenant_utils.provision_schema(o["slug"], db)
        print(f"  created org: {o['slug']}")
    else:
        print(f"  skipped org: {o['slug']} (exists)")

db.commit()

for u in USERS:
    with tenant_session(u["org_slug"]) as tdb:
        if not user_repository.find_by_username(u["username"], tdb):
            user_repository.create(u["username"], auth.hash_password(u["password"]), tdb)
            print(f"  created user: {u['org_slug']}/{u['username']}")
        else:
            print(f"  skipped user: {u['org_slug']}/{u['username']} (exists)")

db.close()
print("\nDone. Demo credentials:")
print("  org: acme   → alice/password123, bob/secret456")
print("  org: globex → carol/globex789")
