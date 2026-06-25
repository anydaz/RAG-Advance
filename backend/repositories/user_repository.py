from sqlalchemy.orm import Session
from database.models import User


def find_by_username(username: str, db: Session) -> User | None:
    return db.query(User).filter_by(username=username).first()


def find_by_id(user_id: int, db: Session) -> User | None:
    return db.query(User).filter_by(id=user_id).first()


def create(username: str, hashed_password: str, db: Session) -> User:
    user = User(username=username, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
