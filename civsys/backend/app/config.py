from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "Civilization Systems"
    DEBUG: bool = True
    POSTGRES_URI: str = "postgresql://postgres:postgres@localhost:5432/civsys"
    DEFAULT_SEED: int = 42

settings = Settings()
