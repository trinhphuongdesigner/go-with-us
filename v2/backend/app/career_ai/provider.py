"""Shared AI gateway. Never expose provider keys or upstream bodies in errors."""

import base64
import hashlib
import ipaddress
import json
import os
import re
import socket
from urllib.parse import quote, urlsplit
import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.career_ai.models import AiConnection

PROVIDERS = ("ANTHROPIC", "OPENAI", "GEMINI")
DEFAULTS = {
    "ANTHROPIC": ("https://api.anthropic.com", "claude-sonnet-4-5"),
    "OPENAI": ("https://api.openai.com/v1", "gpt-4.1-mini"),
    "GEMINI": ("https://generativelanguage.googleapis.com/v1beta", "gemini-2.5-flash"),
}


def cipher() -> Fernet:
    secret = (
        os.getenv("CAREERMATE_AI_ENCRYPTION_KEY") or get_settings().jwt_secret.get_secret_value()
    )
    return Fernet(
        base64.urlsafe_b64encode(
            hashlib.sha256(("careermate:ai-connections:v1:" + secret).encode()).digest()
        )
    )


def validate_endpoint(url: str) -> str:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise HTTPException(422, "AI base URL must be HTTPS without credentials, query or fragment")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        if not addresses or any(
            not ipaddress.ip_address(item[4][0]).is_global for item in addresses
        ):
            raise HTTPException(422, "AI endpoint must resolve to a public address")
    except (socket.gaierror, ValueError):
        raise HTTPException(422, "AI endpoint cannot be resolved") from None
    return url.rstrip("/")


async def send_chat(
    db: AsyncSession,
    system_prompt: str,
    messages: list[dict[str, str]],
    provider: str | None = None,
) -> dict[str, str]:
    rows = {row.provider: row for row in (await db.scalars(select(AiConnection))).all()}
    env_provider = os.getenv("CAREERMATE_AI_PROVIDER", "ANTHROPIC").upper()
    provider = (
        provider
        or next((name for name in PROVIDERS if name in rows), None)
        or (env_provider if os.getenv("CAREERMATE_AI_API_KEY") else None)
    )
    if provider not in PROVIDERS:
        raise HTTPException(
            503, "Chưa kết nối AI. Super Admin cần cấu hình tại Cài đặt → Kết nối AI."
        )
    row = rows.get(provider)
    if row:
        try:
            key = cipher().decrypt(row.encrypted_key.encode()).decode()
        except InvalidToken:
            raise HTTPException(
                503, "Không giải mã được kết nối AI; quản trị viên cần lưu lại khóa."
            ) from None
        base, model = row.base_url, row.model
    elif provider == env_provider and os.getenv("CAREERMATE_AI_API_KEY"):
        key, base, model = (
            os.environ["CAREERMATE_AI_API_KEY"],
            os.getenv("CAREERMATE_AI_BASE_URL"),
            os.getenv("CAREERMATE_AI_MODEL"),
        )
    else:
        raise HTTPException(503, "Nhà cung cấp AI chưa được kết nối")
    base, model = validate_endpoint(base or DEFAULTS[provider][0]), model or DEFAULTS[provider][1]
    headers = {"Content-Type": "application/json"}
    if provider == "ANTHROPIC":
        url = base + ("/messages" if base.endswith("/v1") else "/v1/messages")
        headers.update(
            {"x-api-key": key, "Authorization": f"Bearer {key}", "anthropic-version": "2023-06-01"}
        )
        payload = {
            "model": model,
            "max_tokens": 16384,
            "system": system_prompt,
            "messages": messages,
        }
    elif provider == "OPENAI":
        url = base + "/chat/completions"
        headers["Authorization"] = f"Bearer {key}"
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "max_tokens": 4096,
        }
    else:
        url = base + "/models/" + quote(model, safe="-._") + ":generateContent"
        headers["x-goog-api-key"] = key
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [
                {
                    "role": "model" if item["role"] == "assistant" else "user",
                    "parts": [{"text": item["content"]}],
                }
                for item in messages
            ],
            "generationConfig": {"maxOutputTokens": 4096},
        }
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=False, trust_env=False) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
        if provider == "ANTHROPIC" and isinstance(data.get("choices"), list):
            # Madison accepts Messages requests but can return chat.completion JSON.
            content = data["choices"][0]["message"]["content"]
        elif provider == "ANTHROPIC":
            content = "\n".join(
                item["text"] for item in data["content"] if item.get("type") == "text"
            )
        elif provider == "OPENAI":
            content = data["choices"][0]["message"]["content"]
        else:
            content = "\n".join(
                item.get("text", "") for item in data["candidates"][0]["content"]["parts"]
            )
        if not isinstance(content, str) or not content.strip():
            raise ValueError("empty")
        return {"content": content, "provider": provider}
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        raise HTTPException(
            502,
            "Nhà cung cấp AI chưa trả lời hợp lệ. Không có dữ liệu nghiệp vụ nào được thay đổi.",
        ) from None


def json_reply(content: str) -> dict:
    clean = content.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", clean, re.IGNORECASE)
    if fence:
        clean = fence.group(1).strip()
    try:
        data = json.loads(clean)
        if not isinstance(data, dict):
            raise ValueError()
        return data
    except (ValueError, TypeError):
        raise HTTPException(502, "AI trả về định dạng không hợp lệ; chưa lưu đề xuất.") from None
