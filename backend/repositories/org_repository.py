from sqlalchemy.orm import Session
from database.models import Organization


def find_by_slug(slug: str, db: Session) -> Organization | None:
    return db.query(Organization).filter_by(slug=slug).first()


def create(slug: str, display_name: str, db: Session) -> Organization:
    org = Organization(slug=slug, display_name=display_name)
    db.add(org)
    db.flush()
    return org
