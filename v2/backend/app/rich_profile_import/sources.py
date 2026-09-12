"""Bounded source ingestion; fetch only explicit user URLs, pinned to public IPs."""

import asyncio
import hashlib
import http.client
import ipaddress
import socket
import ssl
from html.parser import HTMLParser
from pathlib import PurePath
from urllib.parse import urljoin, urlsplit
from fastapi import HTTPException, UploadFile
from app.core.config import get_settings
from app.services.document_extractor import (
    DocumentExtractor,
    DocumentExtractionError,
    TesseractOcrExtractor,
)
from app.services.malware_scanner import (
    ClamAvTcpScanner,
    MalwareScanStatus,
    MalwareScannerUnavailable,
)

MAX_FILE = 10 * 1024 * 1024
MAX_URL = 2 * 1024 * 1024


class ReadableHtml(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skipping = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.skipping += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"} and self.skipping:
            self.skipping -= 1

    def handle_data(self, data):
        if not self.skipping and data.strip():
            self.parts.append(data.strip())


class PinnedHttps(http.client.HTTPSConnection):
    def __init__(self, hostname, address):
        super().__init__(hostname, 443, timeout=8, context=ssl.create_default_context())
        self.address = address

    def connect(self):
        sock = socket.create_connection((self.address, 443), timeout=self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def fetch_public_text(url: str) -> str:
    for redirect in range(4):
        try:
            parsed = urlsplit(url)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.port not in {None, 443}
            ):
                raise HTTPException(
                    422, "Chỉ hỗ trợ URL HTTPS công khai, không có thông tin đăng nhập"
                )
            resolved = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
            addresses = list(dict.fromkeys(item[4][0] for item in resolved))
            if not addresses or any(
                not ipaddress.ip_address(address).is_global for address in addresses
            ):
                raise HTTPException(
                    422, "Không cho phép URL nội bộ, localhost hoặc địa chỉ dành riêng"
                )
            connection = PinnedHttps(parsed.hostname, addresses[0])
            try:
                path = parsed.path or "/"
                if parsed.query:
                    path += "?" + parsed.query
                connection.request(
                    "GET",
                    path,
                    headers={
                        "User-Agent": "CareerMate-v2/1.0",
                        "Accept": "text/html,text/plain",
                        "Accept-Encoding": "identity",
                    },
                )
                response = connection.getresponse()
                if response.status in {301, 302, 303, 307, 308}:
                    location = response.getheader("Location")
                    if not location or redirect == 3:
                        raise HTTPException(422, "URL chuyển hướng quá nhiều hoặc không hợp lệ")
                    url = urljoin(url, location)
                    continue
                if response.status != 200:
                    raise HTTPException(
                        422,
                        "Không đọc được trang. Với trang cần đăng nhập, hãy dán nội dung hoặc tải tài liệu.",
                    )
                mime = response.getheader("Content-Type", "").split(";")[0].strip().lower()
                if (
                    mime not in {"text/html", "text/plain", "application/xhtml+xml"}
                    or response.getheader("Content-Encoding", "identity") != "identity"
                ):
                    raise HTTPException(
                        422,
                        "URL phải trả về HTML/văn bản công khai; hãy tải file trực tiếp để nhập tài liệu",
                    )
                data = response.read(MAX_URL + 1)
                if len(data) > MAX_URL:
                    raise HTTPException(413, "Trang vượt giới hạn 2 MB")
                text = data.decode("utf-8", errors="replace")
                if mime != "text/plain":
                    parser = ReadableHtml()
                    parser.feed(text)
                    text = "\n".join(parser.parts)
                return text[:30000]
            finally:
                connection.close()
        except (OSError, ValueError, http.client.HTTPException):
            raise HTTPException(
                422, "Không đọc được URL an toàn. Hãy dán nội dung hoặc tải tài liệu thay thế."
            ) from None
    raise HTTPException(422, "Không đọc được URL")


async def extract_upload(file: UploadFile) -> str:
    content = await file.read(MAX_FILE + 1)
    if not content or len(content) > MAX_FILE:
        raise HTTPException(413, "Mỗi file phải có nội dung và không quá 10 MB")
    settings = get_settings()
    if settings.malware_scanner != "clamav":
        raise HTTPException(
            503, "Bộ quét file chưa sẵn sàng. Có thể dán văn bản hoặc URL công khai trong lúc chờ."
        )
    scanner = ClamAvTcpScanner(
        settings.clamav_host, settings.clamav_port, timeout_seconds=settings.clamav_timeout_seconds
    )
    try:
        result = await scanner.scan(content, sha256=hashlib.sha256(content).hexdigest())
    except MalwareScannerUnavailable:
        raise HTTPException(
            503, "Không kết nối được bộ quét an toàn; chưa gửi file đến AI"
        ) from None
    if result.status != MalwareScanStatus.CLEAN:
        raise HTTPException(422, "File không vượt qua kiểm tra an toàn")
    ocr = (
        TesseractOcrExtractor(settings.tesseract_executable, settings.ocr_timeout_seconds)
        if settings.ocr_engine == "tesseract"
        else None
    )
    extractor = DocumentExtractor(ocr)
    filename, mime = (
        PurePath(file.filename or "document").name,
        file.content_type or "application/octet-stream",
    )
    if filename.lower().endswith((".md", ".markdown")):
        filename, mime = "document.txt", "text/plain"
    try:
        _, blocks = await extractor.extract(filename, mime, content)
        return "\n\n".join(
            f"{('Trang ' + str(block.page_number) + ': ') if block.page_number else ''}{('Sheet ' + block.sheet_name + ': ') if block.sheet_name else ''}{block.text}"
            for block in blocks
        )[:30000]
    except DocumentExtractionError as error:
        raise HTTPException(422, str(error)) from None
