import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.sql import text
import asyncpg  # Import asyncpg directly

from .models import Base  # Import your Base from models.py

load_dotenv()

# Retrieve individual database connection details from environment variables
DB_USER = os.getenv("DB_USER", "user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "knowledge_graph_db")

# Retrieve admin database connection details from environment variables for database creation
ADMIN_DB_USER = os.getenv("ADMIN_DB_USER", "user")
ADMIN_DB_PASSWORD = os.getenv("ADMIN_DB_PASSWORD", "password")
ADMIN_DB_NAME = os.getenv(
    "ADMIN_DB_NAME", "data2in"
)  # Default to a common admin database name like 'postgres' or 'data2in'

# Construct the DATABASE_URL using the individual environment variables
DATABASE_URL = (
    f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)


async def setup_database():
    """
    Ensures the database and schema exist, and creates tables if they don't.
    """
    # Construct the connection string for the admin database using asyncpg directly
    admin_conn_string = f"postgresql://{ADMIN_DB_USER}:{ADMIN_DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{ADMIN_DB_NAME}"
    conn = None  # Initialize conn to None

    try:
        # Establish a direct asyncpg connection for operations that cannot be in a transaction
        conn = await asyncpg.connect(admin_conn_string)

        # Check if the database exists
        db_exists_query = f"SELECT 1 FROM pg_database WHERE datname='{DB_NAME}'"
        db_exists = await conn.fetchval(db_exists_query)

        if not db_exists:
            print(f"Database '{DB_NAME}' does not exist. Creating...")
            # Terminate existing connections to the target database if it exists (for safety, though it shouldn't if it doesn't exist)
            # This command must run outside a transaction.
            await conn.execute(
                f"SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '{DB_NAME}';"
            )
            # Create the database. This command must also run outside a transaction.
            await conn.execute(f"CREATE DATABASE {DB_NAME} OWNER {DB_USER};")
            print(f"Database '{DB_NAME}' created.")
        else:
            print(f"Database '{DB_NAME}' already exists.")
    except Exception as e:
        print(f"Error during database existence check or creation: {e}")
        # Re-raise the exception to propagate it up
        raise
    finally:
        if conn:
            await conn.close()  # Close the direct asyncpg connection

    # Use the SQLAlchemy async engine for table creation in the target database
    # This part runs within a transaction block, which is suitable for DDL operations like CREATE TABLE
    async_engine = create_async_engine(DATABASE_URL, echo=True)

    try:
        async with async_engine.begin() as conn:
            # Create tables if they don't exist
            print("Creating tables...")
            await conn.run_sync(Base.metadata.create_all)
            print("Tables created or already exist.")
    except Exception as e:
        print(f"Error during table creation: {e}")
        raise
    finally:
        await async_engine.dispose()


if __name__ == "__main__":
    import asyncio

    asyncio.run(setup_database())
