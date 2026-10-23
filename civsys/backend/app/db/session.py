import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

uri = os.getenv("DATABASE_URL", settings.POSTGRES_URI)

# Convert async postgres uri to sync for simplicity in standard SQLAlchemy, 
# or fallback to sqlite if postgres is not available
if uri.startswith("postgres://"):
    uri = uri.replace("postgres://", "postgresql://", 1)

# If we're testing or local without postgres, default to sqlite
if "localhost:5432" in uri and not os.getenv("USE_POSTGRES_LOCAL"):
    uri = "sqlite:///./civsys.db"

connect_args = {"check_same_thread": False} if "sqlite" in uri else {}
engine = create_engine(uri, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
