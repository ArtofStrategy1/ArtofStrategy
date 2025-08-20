from fastapi import Request
from ..database.connection import get_db
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession


def get_nlp_model(request: Request):
    return request.app.state.nlp


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async for db_session in get_db():
        yield db_session
