import asyncio
import socket

import pytest
from fastapi import HTTPException

from app.career_ai.provider import validate_endpoint


async def test_endpoint_dns_resolution_runs_off_the_event_loop(monkeypatch) -> None:
    calls: list[tuple[object, tuple[object, ...]]] = []

    async def fake_to_thread(function, *args, **_kwargs):
        calls.append((function, args))
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]

    monkeypatch.setattr(asyncio, "to_thread", fake_to_thread)

    assert await validate_endpoint("https://provider.example/v1") == "https://provider.example/v1"
    assert calls and calls[0][0] is socket.getaddrinfo


async def test_endpoint_dns_resolution_has_a_total_deadline(monkeypatch) -> None:
    async def slow_to_thread(_function, *_args, **_kwargs):
        await asyncio.sleep(1)

    monkeypatch.setattr(asyncio, "to_thread", slow_to_thread)

    with pytest.raises(HTTPException) as error:
        await validate_endpoint("https://provider.example", dns_timeout_seconds=0.001)

    assert error.value.status_code == 422
