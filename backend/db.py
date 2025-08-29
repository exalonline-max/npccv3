from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=False, connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Let the caller handle logging
        raise
