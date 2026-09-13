import time
from collections.abc import Iterator

import pytest
from fastapi import HTTPException

from app.rich_profile_import import routes as routes_module
from app.rich_profile_import.sources import fetch_public_text


class FakeSocket:
    def settimeout(self, timeout: float) -> None:
        self.timeout = timeout


class SlowResponse:
    status = 200

    def getheader(self, name: str, default: str | None = None) -> str | None:
        return {
            "Content-Type": "text/plain",
            "Content-Encoding": "identity",
        }.get(name, default)

    def read(self, size: int) -> bytes:
        return b"still streaming"


class FakeConnection:
    def __init__(self) -> None:
        self.sock = FakeSocket()
        self.closed = False

    def request(self, *args, **kwargs) -> None:
        return None

    def getresponse(self) -> SlowResponse:
        return SlowResponse()

    def close(self) -> None:
        self.closed = True


def test_url_fetch_enforces_one_deadline_across_stream_reads() -> None:
    ticks: Iterator[float] = iter([0.0, 0.1, 0.2, 0.3, 2.0])
    connection = FakeConnection()

    with pytest.raises(HTTPException) as error:
        fetch_public_text(
            "https://example.com/profile",
            total_timeout_seconds=1.0,
            clock=lambda: next(ticks),
            resolver=lambda hostname, timeout: [(None, None, None, None, ("8.8.8.8", 443))],
            connection_factory=lambda hostname, address, timeout: connection,
        )

    assert error.value.status_code == 422
    assert connection.closed is True


async def test_async_url_fetch_deadline_covers_dns_and_response_headers(monkeypatch) -> None:
    def blocking_fetch(url: str) -> str:
        time.sleep(0.2)
        return "late"

    monkeypatch.setattr(routes_module, "fetch_public_text", blocking_fetch)
    started = time.monotonic()
    with pytest.raises(HTTPException) as error:
        await routes_module.fetch_url_text("https://example.com", timeout_seconds=0.01)

    assert error.value.status_code == 422
    assert time.monotonic() - started < 0.15
