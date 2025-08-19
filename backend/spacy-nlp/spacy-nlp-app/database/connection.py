import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

load_dotenv()


def get_database_url():
    """
    Retrieves the PostgreSQL database URL from environment variables.
    """
    return os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:password@localhost/knowledge_graph_db",
    )


DATABASE_URL = get_database_url()
engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """
    Dependency that provides an SQLAlchemy AsyncSession.
    """
    async with AsyncSessionLocal() as session:
        yield session
