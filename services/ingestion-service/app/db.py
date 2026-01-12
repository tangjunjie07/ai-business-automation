import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncGenerator


async def init_db_pool(app, database_url: str):
    """Initialize asyncpg pool and attach to FastAPI app.state."""
    app.state.db_pool = await asyncpg.create_pool(database_url)


async def close_db_pool(app):
    if hasattr(app.state, "db_pool") and app.state.db_pool:
        await app.state.db_pool.close()


@asynccontextmanager
async def get_conn(app) -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire/release a connection from the pool as an async context manager.

    Usage:
        async with get_conn(app) as conn:
            await conn.fetchrow(...)
    """
    conn = await app.state.db_pool.acquire()
    try:
        yield conn
    finally:
        await app.state.db_pool.release(conn)
