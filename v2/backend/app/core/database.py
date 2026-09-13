import re
from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True)


def register_sqlite_compat_functions(target_engine) -> None:
    if target_engine.dialect.name != "sqlite":
        return

    @event.listens_for(target_engine.sync_engine, "connect")
    def add_translate(dbapi_connection, _connection_record) -> None:
        def translate(value, source, target):
            if value is None:
                return ""
            mapping = str.maketrans(
                {
                    character: target[index] if index < len(target) else None
                    for index, character in enumerate(source)
                }
            )
            return str(value).translate(mapping)

        dbapi_connection.create_function("translate", 3, translate, deterministic=True)

        def regexp_replace(value, pattern, replacement, flags):
            if value is None:
                return ""
            re_flags = re.IGNORECASE if "i" in flags else 0
            count = 0 if "g" in flags else 1
            return re.sub(pattern, replacement, str(value), count=count, flags=re_flags)

        dbapi_connection.create_function("regexp_replace", 4, regexp_replace, deterministic=True)


register_sqlite_compat_functions(engine)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session() as session:
        yield session
