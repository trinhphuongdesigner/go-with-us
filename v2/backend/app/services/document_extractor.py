from __future__ import annotations

import asyncio
import csv
import ctypes
import io
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import unicodedata
import weakref
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePath, PurePosixPath
from typing import Any, Literal, Protocol

from defusedxml import ElementTree
from pypdf import PdfReader, apply_configuration

MAX_EXTRACTED_CHARS = 1_000_000
MAX_AI_CONTEXT_BYTES = 2 * 1024 * 1024
MAX_SOURCE_BLOCKS = 1_000
MAX_ZIP_ENTRIES = 1_000
MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024
MAX_PDF_PAGES = 100
MAX_PDF_OCR_PAGES = 10
MAX_PDF_OCR_SOURCE_BYTES = 10 * 1024 * 1024
MAX_PDF_OCR_PAGE_PIXELS = 4_000_000
MAX_PDF_OCR_TOTAL_PIXELS = 20_000_000
MAX_PDF_OCR_PAGE_BYTES = 5 * 1024 * 1024
MAX_PDF_OCR_TOTAL_BYTES = 20 * 1024 * 1024
MAX_PDF_OCR_SECONDS = 30.0
PDF_OCR_DPI = 150

_MAX_PDF_STREAM_BYTES = 10 * 1024 * 1024
MAX_PDF_DECODED_TOTAL_BYTES = 25 * 1024 * 1024
MAX_PDF_PAGE_TREE_DEPTH = 32
MAX_PDF_PAGE_TREE_ENTRIES = 1_000
MAX_PDF_XFORM_INVOCATIONS = 100
PDF_WORKER_MEMORY_BYTES = 128 * 1024 * 1024
PDF_WORKER_CPU_SECONDS = 4
PDF_WORKER_WALL_SECONDS = 5.0
PDF_WORKER_POLL_SECONDS = 0.05
PDF_WORKER_RESULT_MAX_BYTES = 5 * 1024 * 1024
PDF_WORKER_CONCURRENCY = 2
PDF_WORKER_MONITOR_MISSES = 5
PDF_WORKER_SCRIPT_PATH = Path(__file__).resolve()
MAX_IMAGE_OCR_PIXELS = 4_000_000
MAX_OCR_OUTPUT_BYTES = MAX_AI_CONTEXT_BYTES
MAX_OCR_WORKER_WALL_SECONDS = 20.0

_PDF_WORKER_SEMAPHORES: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Semaphore] = (
    weakref.WeakKeyDictionary()
)
_ACTIVE_PDF_WORKER_PIDS: set[int] = set()


class DocumentExtractionError(ValueError):
    pass


class OcrUnavailable(DocumentExtractionError):
    pass


class OcrExtractor(Protocol):
    async def extract(self, content: bytes, *, mime_type: str) -> str: ...


class UnavailableOcrExtractor:
    async def extract(self, content: bytes, *, mime_type: str) -> str:
        del content, mime_type
        raise OcrUnavailable("OCR is not configured")


class TesseractOcrExtractor:
    def __init__(self, executable: str = "tesseract", timeout_seconds: float = 20.0) -> None:
        self.executable = executable
        self.timeout_seconds = timeout_seconds

    async def extract(self, content: bytes, *, mime_type: str) -> str:
        _validate_ocr_image(content, mime_type)
        executable = shutil.which(self.executable)
        if executable is None:
            raise OcrUnavailable("OCR is not available")
        try:
            stdout = await _run_isolated_ocr_worker(
                content,
                mime_type,
                executable,
                timeout_seconds=min(self.timeout_seconds, MAX_OCR_WORKER_WALL_SECONDS),
            )
        except OSError as error:
            raise OcrUnavailable("OCR is not available") from error
        try:
            return _normalize_text(stdout.decode("utf-8", errors="strict"))
        except UnicodeDecodeError as error:
            raise DocumentExtractionError("OCR returned invalid text") from error


@dataclass(frozen=True)
class ExtractedBlock:
    text: str
    page_number: int | None = None
    sheet_name: str | None = None


@dataclass(frozen=True)
class RenderedPdfPage:
    content: bytes
    mime_type: str
    pixel_count: int


@dataclass(frozen=True)
class _PdfWorkerResponse:
    message: dict[str, object]
    artifact: bytes | None = None


@dataclass
class _PdfTextBudgetGuard:
    observed_chars: int
    exceeded: bool = False

    def visit_text(self, text: str, *_args: Any) -> None:
        self.observed_chars += len(text)
        if self.observed_chars > MAX_EXTRACTED_CHARS:
            self.exceeded = True
            raise DocumentExtractionError("Nội dung trích xuất vượt giới hạn")

    def before_operand(self, *_args: Any) -> None:
        if self.exceeded:
            raise DocumentExtractionError("Nội dung trích xuất vượt giới hạn")


class PdfPageRenderer(Protocol):
    def render_page(
        self, content: bytes, *, page_number: int, max_pixels: int
    ) -> RenderedPdfPage: ...


class PdfiumPageRenderer:
    def render_page(self, content: bytes, *, page_number: int, max_pixels: int) -> RenderedPdfPage:
        try:
            import pypdfium2 as pdfium  # type: ignore[import-untyped]
        except ImportError as error:
            raise OcrUnavailable("PDF OCR renderer is not available") from error

        document = None
        page = None
        bitmap = None
        try:
            document = pdfium.PdfDocument(content)
            page = document[page_number - 1]
            scale = PDF_OCR_DPI / 72
            width, height = page.get_size()
            estimated_pixels = math.ceil(width * scale) * math.ceil(height * scale)
            if estimated_pixels > max_pixels:
                raise DocumentExtractionError("PDF OCR vượt giới hạn điểm ảnh")
            bitmap = page.render(scale=scale, grayscale=True, limit_image_cache=True)
            pixel_count = bitmap.width * bitmap.height
            if pixel_count > max_pixels:
                raise DocumentExtractionError("PDF OCR vượt giới hạn điểm ảnh")
            raw = bytes(bitmap.buffer)
            if bitmap.stride == bitmap.width:
                pixels = raw
            else:
                pixels = b"".join(
                    raw[offset : offset + bitmap.width]
                    for offset in range(0, bitmap.stride * bitmap.height, bitmap.stride)
                )
            header = f"P5\n{bitmap.width} {bitmap.height}\n255\n".encode("ascii")
            return RenderedPdfPage(
                content=header + pixels,
                mime_type="image/x-portable-graymap",
                pixel_count=pixel_count,
            )
        except DocumentExtractionError:
            raise
        except Exception as error:
            raise DocumentExtractionError("Không thể rasterize trang PDF cho OCR") from error
        finally:
            if bitmap is not None:
                bitmap.close()
            if page is not None:
                page.close()
            if document is not None:
                document.close()


@dataclass(frozen=True)
class DocumentKind:
    extension: str
    mime_types: frozenset[str]


DOCUMENT_KINDS = {
    ".txt": DocumentKind(".txt", frozenset({"text/plain"})),
    ".csv": DocumentKind(".csv", frozenset({"text/csv", "application/csv"})),
    ".pdf": DocumentKind(".pdf", frozenset({"application/pdf"})),
    ".docx": DocumentKind(
        ".docx",
        frozenset({"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),
    ),
    ".xlsx": DocumentKind(
        ".xlsx",
        frozenset({"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),
    ),
    ".png": DocumentKind(".png", frozenset({"image/png"})),
    ".jpg": DocumentKind(".jpg", frozenset({"image/jpeg"})),
    ".jpeg": DocumentKind(".jpeg", frozenset({"image/jpeg"})),
    ".webp": DocumentKind(".webp", frozenset({"image/webp"})),
}


class DocumentExtractor:
    def __init__(
        self,
        ocr: OcrExtractor | None = None,
        *,
        pdf_renderer: PdfPageRenderer | None = None,
    ) -> None:
        self.ocr = ocr or UnavailableOcrExtractor()
        self.pdf_renderer = pdf_renderer or PdfiumPageRenderer()

    def validate(self, filename: str, mime_type: str, content: bytes) -> str:
        extension = PurePath(filename).suffix.casefold()
        kind = DOCUMENT_KINDS.get(extension)
        if kind is None or mime_type not in kind.mime_types:
            raise DocumentExtractionError("Định dạng hoặc MIME không được hỗ trợ")
        _validate_magic(extension, content)
        return extension

    async def extract(
        self, filename: str, mime_type: str, content: bytes
    ) -> tuple[str, list[ExtractedBlock]]:
        extension = self.validate(filename, mime_type, content)
        if extension == ".txt":
            blocks = [ExtractedBlock(_decode_utf8(content))]
        elif extension == ".csv":
            blocks = _extract_csv(content)
        elif extension == ".pdf":
            blocks = await _extract_pdf(content, self.ocr, self.pdf_renderer)
        elif extension == ".docx":
            blocks = _extract_docx(content)
        elif extension == ".xlsx":
            blocks = _extract_xlsx(content)
        else:
            _validate_ocr_image(content, mime_type)
            blocks = [ExtractedBlock(await self.ocr.extract(content, mime_type=mime_type))]
        normalized: list[ExtractedBlock] = []
        total_chars = 0
        total_bytes = 0
        for block in blocks:
            if not block.text.strip():
                continue
            normalized_block = ExtractedBlock(
                text=_normalize_text(block.text),
                page_number=block.page_number,
                sheet_name=block.sheet_name,
            )
            total_chars += len(normalized_block.text)
            total_bytes += len(normalized_block.text.encode("utf-8"))
            if len(normalized) >= MAX_SOURCE_BLOCKS:
                raise DocumentExtractionError("Tài liệu vượt giới hạn 1.000 khối nội dung")
            if total_chars > MAX_EXTRACTED_CHARS or total_bytes > MAX_AI_CONTEXT_BYTES:
                raise DocumentExtractionError("Nội dung trích xuất vượt giới hạn")
            normalized.append(normalized_block)
        if not normalized:
            raise DocumentExtractionError("Tài liệu không có nội dung văn bản")
        return extension, normalized


def _decode_utf8(content: bytes) -> str:
    try:
        text = content.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as error:
        raise DocumentExtractionError("Văn bản phải dùng UTF-8 hợp lệ") from error
    if "\x00" in text:
        raise DocumentExtractionError("Văn bản không hợp lệ")
    return text


def canonicalize_text(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    return unicodedata.normalize("NFC", value)


def _normalize_text(value: str) -> str:
    value = canonicalize_text(value)
    value = re.sub(r"[\t ]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return canonicalize_text(value.strip())


def _validate_magic(extension: str, content: bytes) -> None:
    valid = {
        ".pdf": content.startswith(b"%PDF-"),
        ".docx": content.startswith(b"PK\x03\x04"),
        ".xlsx": content.startswith(b"PK\x03\x04"),
        ".png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        ".jpg": content.startswith(b"\xff\xd8\xff"),
        ".jpeg": content.startswith(b"\xff\xd8\xff"),
        ".webp": len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }.get(extension, True)
    if not valid:
        raise DocumentExtractionError("Magic bytes không khớp định dạng")


def _validate_image_dimensions(width: int, height: int) -> None:
    if width <= 0 or height <= 0 or width * height > MAX_IMAGE_OCR_PIXELS:
        raise DocumentExtractionError("Ảnh OCR vượt giới hạn điểm ảnh")


def _jpeg_dimensions(content: bytes) -> tuple[int, int]:
    start_of_frame = {
        0xC0,
        0xC1,
        0xC2,
        0xC3,
        0xC5,
        0xC6,
        0xC7,
        0xC9,
        0xCA,
        0xCB,
        0xCD,
        0xCE,
        0xCF,
    }
    offset = 2
    while offset < len(content):
        if content[offset] != 0xFF:
            raise DocumentExtractionError("JPEG không có cấu trúc hợp lệ")
        while offset < len(content) and content[offset] == 0xFF:
            offset += 1
        if offset >= len(content):
            break
        marker = content[offset]
        offset += 1
        if marker in {0x01, *range(0xD0, 0xDA)}:
            continue
        if offset + 2 > len(content):
            break
        segment_length = int.from_bytes(content[offset : offset + 2], "big")
        if segment_length < 2 or offset + segment_length > len(content):
            break
        if marker in start_of_frame:
            if segment_length < 7:
                break
            height = int.from_bytes(content[offset + 3 : offset + 5], "big")
            width = int.from_bytes(content[offset + 5 : offset + 7], "big")
            return width, height
        if marker == 0xDA:
            break
        offset += segment_length
    raise DocumentExtractionError("JPEG thiếu kích thước ảnh hợp lệ")


def _webp_dimensions(content: bytes) -> tuple[int, int]:
    if len(content) < 30:
        raise DocumentExtractionError("WebP thiếu kích thước ảnh hợp lệ")
    chunk_type = content[12:16]
    if chunk_type == b"VP8X":
        width = int.from_bytes(content[24:27], "little") + 1
        height = int.from_bytes(content[27:30], "little") + 1
        return width, height
    if chunk_type == b"VP8L" and content[20] == 0x2F:
        bits = int.from_bytes(content[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk_type == b"VP8 " and content[23:26] == b"\x9d\x01\x2a":
        width = int.from_bytes(content[26:28], "little") & 0x3FFF
        height = int.from_bytes(content[28:30], "little") & 0x3FFF
        return width, height
    raise DocumentExtractionError("WebP thiếu kích thước ảnh hợp lệ")


def _validate_ocr_image(content: bytes, mime_type: str) -> None:
    if len(content) > MAX_PDF_OCR_SOURCE_BYTES:
        raise DocumentExtractionError("Ảnh OCR vượt giới hạn dung lượng")
    if mime_type == "image/png":
        if len(content) < 24 or content[12:16] != b"IHDR":
            raise DocumentExtractionError("PNG thiếu IHDR hợp lệ")
        width = int.from_bytes(content[16:20], "big")
        height = int.from_bytes(content[20:24], "big")
    elif mime_type == "image/jpeg":
        width, height = _jpeg_dimensions(content)
    elif mime_type == "image/webp":
        width, height = _webp_dimensions(content)
    elif mime_type == "image/x-portable-graymap":
        match = re.match(rb"^P5\s+(\d+)\s+(\d+)\s+255\s", content[:128])
        if match is None:
            raise DocumentExtractionError("Ảnh PGM không hợp lệ")
        width, height = int(match.group(1)), int(match.group(2))
    else:
        raise DocumentExtractionError("Định dạng ảnh OCR không được hỗ trợ")
    _validate_image_dimensions(width, height)


def _extract_csv(content: bytes) -> list[ExtractedBlock]:
    text = _decode_utf8(content)
    blocks: list[ExtractedBlock] = []
    try:
        for row in csv.reader(io.StringIO(text), strict=True):
            values = [cell.strip() for cell in row if cell.strip()]
            if not values:
                continue
            if len(blocks) >= MAX_SOURCE_BLOCKS:
                raise DocumentExtractionError("Tài liệu vượt giới hạn 1.000 khối nội dung")
            blocks.append(ExtractedBlock(" | ".join(values)))
    except csv.Error as error:
        raise DocumentExtractionError("CSV không hợp lệ") from error
    return blocks


async def _extract_pdf(
    content: bytes, ocr: OcrExtractor, renderer: PdfPageRenderer
) -> list[ExtractedBlock]:
    blocks = _parse_pdf_text_worker_response(await _run_isolated_pdf_worker(content, "text"))

    pages_requiring_ocr = [
        block.page_number
        for block in blocks
        if not block.text.strip() and block.page_number is not None
    ]
    if not pages_requiring_ocr:
        return blocks
    if len(content) > MAX_PDF_OCR_SOURCE_BYTES:
        raise DocumentExtractionError("PDF OCR vượt giới hạn dung lượng nguồn")
    if len(pages_requiring_ocr) > MAX_PDF_OCR_PAGES:
        raise DocumentExtractionError("PDF OCR vượt giới hạn số trang")

    total_pixels = 0
    total_bytes = 0
    try:
        async with asyncio.timeout(MAX_PDF_OCR_SECONDS):
            for page_number in pages_requiring_ocr:
                if isinstance(renderer, PdfiumPageRenderer):
                    rendered = _parse_pdf_render_worker_response(
                        await _run_isolated_pdf_worker(
                            content,
                            "render",
                            page_number=page_number,
                            max_pixels=MAX_PDF_OCR_PAGE_PIXELS,
                        )
                    )
                else:
                    rendered = await asyncio.to_thread(
                        renderer.render_page,
                        content,
                        page_number=page_number,
                        max_pixels=MAX_PDF_OCR_PAGE_PIXELS,
                    )
                total_pixels += rendered.pixel_count
                total_bytes += len(rendered.content)
                if (
                    rendered.pixel_count > MAX_PDF_OCR_PAGE_PIXELS
                    or total_pixels > MAX_PDF_OCR_TOTAL_PIXELS
                    or len(rendered.content) > MAX_PDF_OCR_PAGE_BYTES
                    or total_bytes > MAX_PDF_OCR_TOTAL_BYTES
                ):
                    raise DocumentExtractionError("PDF OCR vượt giới hạn tài nguyên")
                text = await ocr.extract(rendered.content, mime_type=rendered.mime_type)
                blocks[page_number - 1] = ExtractedBlock(text, page_number=page_number)
    except TimeoutError as error:
        raise DocumentExtractionError("PDF OCR vượt giới hạn thời gian") from error
    return blocks


def _extract_pdf_text(content: bytes) -> list[ExtractedBlock]:
    try:
        with apply_configuration(
            maximum_declared_stream_length=_MAX_PDF_STREAM_BYTES,
            array_based_stream_maximum_output_length=_MAX_PDF_STREAM_BYTES,
            jbig2_maximum_output_length=_MAX_PDF_STREAM_BYTES,
            lzw_maximum_output_length=_MAX_PDF_STREAM_BYTES,
            run_length_maximum_output_length=_MAX_PDF_STREAM_BYTES,
            zlib_maximum_output_length=_MAX_PDF_STREAM_BYTES,
            image_maximum_buffer_size=_MAX_PDF_STREAM_BYTES,
            page_tree_maximum_depth=MAX_PDF_PAGE_TREE_DEPTH,
            page_tree_maximum_entries=MAX_PDF_PAGE_TREE_ENTRIES,
            xform_maximum_invocations_per_extraction=MAX_PDF_XFORM_INVOCATIONS,
        ):
            reader = PdfReader(io.BytesIO(content), strict=True)
            if reader.is_encrypted or len(reader.pages) > MAX_PDF_PAGES:
                raise DocumentExtractionError("PDF bị mã hóa hoặc vượt quá 100 trang")
            blocks = []
            total_chars = 0
            decoded_bytes = 0
            seen_streams: set[tuple[str, int, int]] = set()
            for index, page in enumerate(reader.pages, start=1):
                decoded_bytes += _decoded_text_stream_bytes(
                    page,
                    seen_streams,
                    remaining=MAX_PDF_DECODED_TOTAL_BYTES - decoded_bytes,
                )
                text_budget = _PdfTextBudgetGuard(total_chars)
                page_text = (
                    page.extract_text(
                        visitor_text=text_budget.visit_text,
                        visitor_operand_before=text_budget.before_operand,
                    )
                    or ""
                )
                if text_budget.exceeded:
                    raise DocumentExtractionError("Nội dung trích xuất vượt giới hạn")
                total_chars += len(page_text)
                if total_chars > MAX_EXTRACTED_CHARS:
                    raise DocumentExtractionError("Nội dung trích xuất vượt giới hạn")
                blocks.append(ExtractedBlock(page_text, page_number=index))
    except DocumentExtractionError:
        raise
    except Exception as error:
        raise DocumentExtractionError("PDF không hợp lệ hoặc không thể trích xuất") from error
    return blocks


def _set_pdf_worker_resource_limits() -> None:
    try:
        import resource
    except ImportError:
        return

    try:
        resource.setrlimit(
            resource.RLIMIT_CPU,
            (PDF_WORKER_CPU_SECONDS, PDF_WORKER_CPU_SECONDS + 1),
        )
    except (OSError, ValueError):
        pass

    for limit_name in ("RLIMIT_AS", "RLIMIT_DATA"):
        limit = getattr(resource, limit_name, None)
        if limit is None:
            continue
        try:
            _soft, hard = resource.getrlimit(limit)
            bounded_hard = (
                PDF_WORKER_MEMORY_BYTES
                if hard == resource.RLIM_INFINITY or hard > PDF_WORKER_MEMORY_BYTES
                else hard
            )
            resource.setrlimit(limit, (bounded_hard, bounded_hard))
        except (OSError, ValueError):
            # macOS cannot lower these below its large pre-mapped VM footprint;
            # the parent still enforces RSS with an independent monitor.
            continue


def _write_pdf_worker_result(output_path: Path, result: dict[str, object]) -> None:
    output_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


def _pdf_text_worker(input_path: Path, output_path: Path) -> None:
    _set_pdf_worker_resource_limits()
    try:
        blocks = _extract_pdf_text(input_path.read_bytes())
        _write_pdf_worker_result(
            output_path,
            {
                "status": "ok",
                "blocks": [
                    {"text": block.text, "pageNumber": block.page_number} for block in blocks
                ],
            },
        )
    except DocumentExtractionError as error:
        _write_pdf_worker_result(output_path, {"status": "error", "error": str(error)})
    except MemoryError:
        _write_pdf_worker_result(
            output_path, {"status": "error", "error": "PDF vượt giới hạn bộ nhớ"}
        )
    except Exception:  # noqa: BLE001 -- process boundary must never leak parser failures
        _write_pdf_worker_result(
            output_path,
            {"status": "error", "error": "PDF không hợp lệ hoặc không thể trích xuất"},
        )


def _pdf_render_worker(
    input_path: Path, output_path: Path, *, page_number: int, max_pixels: int
) -> None:
    _set_pdf_worker_resource_limits()
    artifact_path = output_path.with_suffix(".bin")
    try:
        rendered = PdfiumPageRenderer().render_page(
            input_path.read_bytes(), page_number=page_number, max_pixels=max_pixels
        )
        artifact_path.write_bytes(rendered.content)
        artifact_path.chmod(0o600)
        _write_pdf_worker_result(
            output_path,
            {
                "status": "ok",
                "mimeType": rendered.mime_type,
                "pixelCount": rendered.pixel_count,
            },
        )
    except DocumentExtractionError as error:
        _write_pdf_worker_result(output_path, {"status": "error", "error": str(error)})
    except MemoryError:
        _write_pdf_worker_result(
            output_path, {"status": "error", "error": "PDF vượt giới hạn bộ nhớ"}
        )
    except Exception:  # noqa: BLE001 -- process boundary must never leak parser failures
        _write_pdf_worker_result(
            output_path,
            {"status": "error", "error": "Không thể rasterize trang PDF cho OCR"},
        )


def _resident_bytes(process_id: int) -> int | None:
    if sys.platform.startswith("linux"):
        try:
            resident_pages = int(Path(f"/proc/{process_id}/statm").read_text().split()[1])
        except (IndexError, OSError, ValueError):
            return None
        return resident_pages * os.sysconf("SC_PAGE_SIZE")
    if sys.platform == "darwin":
        try:
            task_info_size = 96
            task_info = ctypes.create_string_buffer(task_info_size)
            libproc = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
            proc_pidinfo = libproc.proc_pidinfo
            proc_pidinfo.argtypes = [
                ctypes.c_int,
                ctypes.c_int,
                ctypes.c_uint64,
                ctypes.c_void_p,
                ctypes.c_int,
            ]
            proc_pidinfo.restype = ctypes.c_int
            written = proc_pidinfo(
                process_id,
                4,  # PROC_PIDTASKINFO
                0,
                ctypes.byref(task_info),
                task_info_size,
            )
            if written != task_info_size:
                return None
            _virtual_size, resident_size = struct.unpack_from("=QQ", task_info.raw)
            return int(resident_size)
        except (AttributeError, OSError, struct.error):
            return None
    return None


def _pdf_worker_semaphore() -> asyncio.Semaphore:
    loop = asyncio.get_running_loop()
    semaphore = _PDF_WORKER_SEMAPHORES.get(loop)
    if semaphore is None:
        semaphore = asyncio.Semaphore(PDF_WORKER_CONCURRENCY)
        _PDF_WORKER_SEMAPHORES[loop] = semaphore
    return semaphore


async def _stop_process(process: asyncio.subprocess.Process, wait_task: asyncio.Task[int]) -> None:
    if process.returncode is None:
        try:
            process.terminate()
        except ProcessLookupError:
            pass
    try:
        await asyncio.wait_for(asyncio.shield(wait_task), timeout=0.2)
    except TimeoutError:
        if process.returncode is None:
            try:
                process.kill()
            except ProcessLookupError:
                pass
        await asyncio.shield(wait_task)


async def _await_bounded_process(
    process: asyncio.subprocess.Process,
    *,
    wall_seconds: float,
    timeout_error: str,
    memory_error: str,
    monitor_error: str,
    output_path: Path | None = None,
    output_cap: int | None = None,
    output_error: str | None = None,
) -> None:
    _ACTIVE_PDF_WORKER_PIDS.add(process.pid)
    wait_task = asyncio.create_task(process.wait())
    deadline = time.monotonic() + wall_seconds
    failure: str | None = None
    monitor_misses = 0
    try:
        while process.returncode is None:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                failure = timeout_error
                break
            done, _pending = await asyncio.wait(
                {wait_task}, timeout=min(PDF_WORKER_POLL_SECONDS, remaining)
            )
            if done:
                break
            if output_path is not None and output_cap is not None:
                try:
                    output_size = output_path.stat().st_size
                except FileNotFoundError:
                    output_size = 0
                if output_size > output_cap:
                    failure = output_error or "Worker trả kết quả vượt giới hạn"
                    break
            resident_bytes = _resident_bytes(process.pid)
            if resident_bytes is None:
                monitor_misses += 1
                if process.returncode is None and monitor_misses > PDF_WORKER_MONITOR_MISSES:
                    failure = monitor_error
                    break
                continue
            monitor_misses = 0
            if resident_bytes > PDF_WORKER_MEMORY_BYTES:
                failure = memory_error
                break
    finally:
        await _stop_process(process, wait_task)
        _ACTIVE_PDF_WORKER_PIDS.discard(process.pid)

    if failure is not None:
        raise DocumentExtractionError(failure)


async def _run_isolated_pdf_worker(
    content: bytes,
    mode: Literal["text", "render"],
    *,
    page_number: int | None = None,
    max_pixels: int | None = None,
) -> _PdfWorkerResponse:
    if not (sys.platform.startswith("linux") or sys.platform == "darwin"):
        raise DocumentExtractionError("Nền tảng không hỗ trợ cô lập PDF an toàn")
    if mode == "render" and (page_number is None or max_pixels is None):
        raise DocumentExtractionError("Thiếu cấu hình PDF render worker")

    async with _pdf_worker_semaphore():
        with tempfile.TemporaryDirectory(prefix="careermate-pdf-") as temporary_directory:
            temporary_path = Path(temporary_directory)
            input_path = temporary_path / "source.pdf"
            output_path = temporary_path / "result.json"
            input_path.write_bytes(content)
            input_path.chmod(0o600)
            command = [
                sys.executable,
                str(PDF_WORKER_SCRIPT_PATH),
                f"--pdf-{mode}-worker",
                str(input_path),
                str(output_path),
            ]
            if mode == "render":
                command.extend([str(page_number), str(max_pixels)])
            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
            )
            await _await_bounded_process(
                process,
                wall_seconds=PDF_WORKER_WALL_SECONDS,
                timeout_error="PDF vượt giới hạn thời gian xử lý",
                memory_error="PDF vượt giới hạn bộ nhớ",
                monitor_error="Không thể giám sát bộ nhớ PDF worker",
                output_path=output_path,
                output_cap=PDF_WORKER_RESULT_MAX_BYTES,
                output_error="PDF worker trả kết quả vượt giới hạn",
            )
            if process.returncode != 0 or not output_path.is_file():
                raise DocumentExtractionError("PDF worker kết thúc không có kết quả")
            if output_path.stat().st_size > PDF_WORKER_RESULT_MAX_BYTES:
                raise DocumentExtractionError("PDF worker trả kết quả vượt giới hạn")
            try:
                message = json.loads(output_path.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
                raise DocumentExtractionError("PDF worker trả kết quả không hợp lệ") from error
            if not isinstance(message, dict):
                raise DocumentExtractionError("PDF worker trả kết quả không hợp lệ")
            artifact_path = output_path.with_suffix(".bin")
            artifact: bytes | None = None
            if artifact_path.is_file():
                if artifact_path.stat().st_size > MAX_PDF_OCR_PAGE_BYTES:
                    raise DocumentExtractionError("PDF worker trả ảnh vượt giới hạn")
                artifact = artifact_path.read_bytes()
            return _PdfWorkerResponse(message=message, artifact=artifact)


async def _run_isolated_ocr_worker(
    content: bytes,
    mime_type: str,
    executable: str,
    *,
    timeout_seconds: float,
) -> bytes:
    if not (sys.platform.startswith("linux") or sys.platform == "darwin"):
        raise DocumentExtractionError("Nền tảng không hỗ trợ cô lập OCR an toàn")
    if timeout_seconds <= 0:
        raise DocumentExtractionError("OCR vượt giới hạn thời gian xử lý")
    suffixes = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/x-portable-graymap": ".pgm",
    }
    suffix = suffixes.get(mime_type)
    if suffix is None:
        raise DocumentExtractionError("Định dạng ảnh OCR không được hỗ trợ")

    async with _pdf_worker_semaphore():
        with tempfile.TemporaryDirectory(prefix="careermate-ocr-") as temporary_directory:
            temporary_path = Path(temporary_directory)
            input_path = temporary_path / f"source{suffix}"
            output_path = temporary_path / "ocr.txt"
            input_path.write_bytes(content)
            input_path.chmod(0o600)
            with output_path.open("wb") as output_stream:
                process = await asyncio.create_subprocess_exec(
                    sys.executable,
                    str(PDF_WORKER_SCRIPT_PATH),
                    "--ocr-exec-worker",
                    executable,
                    str(input_path),
                    stdin=subprocess.DEVNULL,
                    stdout=output_stream,
                    stderr=subprocess.DEVNULL,
                    close_fds=True,
                )
            await _await_bounded_process(
                process,
                wall_seconds=timeout_seconds,
                timeout_error="OCR vượt giới hạn thời gian xử lý",
                memory_error="OCR vượt giới hạn bộ nhớ",
                monitor_error="Không thể giám sát bộ nhớ OCR worker",
                output_path=output_path,
                output_cap=MAX_OCR_OUTPUT_BYTES,
                output_error="OCR output vượt giới hạn dung lượng",
            )
            if process.returncode != 0:
                raise DocumentExtractionError("OCR failed")
            if not output_path.is_file() or output_path.stat().st_size > MAX_OCR_OUTPUT_BYTES:
                raise DocumentExtractionError("OCR output vượt giới hạn dung lượng")
            return output_path.read_bytes()


def _raise_pdf_worker_error(message: dict[str, object]) -> None:
    if message.get("status") == "error" and isinstance(message.get("error"), str):
        raise DocumentExtractionError(str(message["error"]))


def _parse_pdf_text_worker_response(response: _PdfWorkerResponse) -> list[ExtractedBlock]:
    message = response.message
    _raise_pdf_worker_error(message)
    payload = message.get("blocks")
    status = message.get("status")
    if status != "ok" or not isinstance(payload, list):
        raise DocumentExtractionError("PDF worker trả kết quả không hợp lệ")
    blocks: list[ExtractedBlock] = []
    for item in payload:
        if (
            not isinstance(item, dict)
            or not isinstance(item.get("text"), str)
            or (item.get("pageNumber") is not None and not isinstance(item.get("pageNumber"), int))
        ):
            raise DocumentExtractionError("PDF worker trả kết quả không hợp lệ")
        blocks.append(ExtractedBlock(item["text"], page_number=item.get("pageNumber")))
    return blocks


def _parse_pdf_render_worker_response(response: _PdfWorkerResponse) -> RenderedPdfPage:
    message = response.message
    _raise_pdf_worker_error(message)
    mime_type = message.get("mimeType")
    pixel_count = message.get("pixelCount")
    if (
        message.get("status") != "ok"
        or mime_type != "image/x-portable-graymap"
        or not isinstance(pixel_count, int)
        or pixel_count < 0
        or response.artifact is None
    ):
        raise DocumentExtractionError("PDF render worker trả kết quả không hợp lệ")
    return RenderedPdfPage(response.artifact, mime_type, pixel_count)


def _decoded_text_stream_bytes(
    page: Any,
    seen: set[tuple[str, int, int]],
    *,
    remaining: int,
) -> int:
    """Decode only streams that pypdf text extraction traverses, with a total budget."""

    def resolve(value: Any) -> Any:
        get_object = getattr(value, "get_object", None)
        return get_object() if callable(get_object) else value

    def identity(value: Any) -> tuple[str, int, int]:
        reference = getattr(value, "indirect_reference", None)
        if reference is not None:
            return ("indirect", int(reference.idnum), int(reference.generation))
        return ("direct", id(value), 0)

    def mapping_value(value: Any, key: str) -> Any:
        resolved = resolve(value)
        getter = getattr(resolved, "get", None)
        return resolve(getter(key)) if callable(getter) else None

    def inherited_resources(value: Any) -> Any:
        resolved = resolve(value)
        get_inherited = getattr(resolved, "get_inherited", None)
        if callable(get_inherited):
            return resolve(get_inherited(key="/Resources", default={}))
        return mapping_value(resolved, "/Resources")

    def values(value: Any) -> tuple[Any, ...]:
        resolved = resolve(value)
        value_getter = getattr(resolved, "values", None)
        return tuple(value_getter()) if callable(value_getter) else ()

    def sequence(value: Any) -> tuple[Any, ...]:
        resolved = resolve(value)
        return tuple(resolved) if isinstance(resolved, (list, tuple)) else ()

    def consume(value: Any, available: int) -> int:
        resolved = resolve(value)
        if isinstance(resolved, (list, tuple)):
            used = 0
            for item in resolved:
                used += consume(item, available - used)
            return used
        get_data = getattr(resolved, "get_data", None)
        if not callable(get_data):
            return 0
        stream_id = identity(resolved)
        if stream_id in seen:
            return 0
        seen.add(stream_id)
        size = len(get_data())
        if size > available:
            raise DocumentExtractionError("PDF vượt giới hạn tổng dữ liệu giải nén")
        used = size
        used += consume_resources(inherited_resources(resolved), available - used)
        return used

    def consume_font(font_ref: Any, available: int) -> int:
        font = resolve(font_ref)
        used = consume(mapping_value(font, "/ToUnicode"), available)
        descriptor = mapping_value(font, "/FontDescriptor")
        for key in ("/FontFile", "/FontFile2", "/FontFile3"):
            used += consume(mapping_value(descriptor, key), available - used)
        for descendant in sequence(mapping_value(font, "/DescendantFonts")):
            used += consume_font(descendant, available - used)
        return used

    def consume_resources(resources_ref: Any, available: int) -> int:
        resources = resolve(resources_ref)
        used = 0
        for font_ref in values(mapping_value(resources, "/Font")):
            used += consume_font(font_ref, available - used)
        for child_ref in values(mapping_value(resources, "/XObject")):
            child = resolve(child_ref)
            if str(mapping_value(child, "/Subtype")) == "/Form":
                used += consume(child, available - used)
        return used

    raw_get = getattr(page, "raw_get", None)
    if callable(raw_get):
        try:
            contents = raw_get("/Contents")
        except KeyError:
            contents = None
    else:
        get_contents = getattr(page, "get_contents", None)
        contents = get_contents() if callable(get_contents) else None
    used = consume(contents, remaining) if contents is not None else 0
    used += consume_resources(inherited_resources(page), remaining - used)
    return used


def _safe_zip(content: bytes) -> zipfile.ZipFile:
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
        infos = archive.infolist()
    except (OSError, zipfile.BadZipFile) as error:
        raise DocumentExtractionError("Tệp OpenXML không hợp lệ") from error
    if (
        len(infos) > MAX_ZIP_ENTRIES
        or sum(info.file_size for info in infos) > MAX_UNCOMPRESSED_BYTES
    ):
        archive.close()
        raise DocumentExtractionError("Tệp OpenXML vượt giới hạn giải nén")
    if any(
        info.file_size > 0 and info.compress_size > 0 and info.file_size / info.compress_size > 200
        for info in infos
    ):
        archive.close()
        raise DocumentExtractionError("Tệp OpenXML có tỷ lệ nén không an toàn")
    return archive


def _extract_docx(content: bytes) -> list[ExtractedBlock]:
    with _safe_zip(content) as archive:
        try:
            root = ElementTree.fromstring(archive.read("word/document.xml"))
        except (KeyError, ElementTree.ParseError) as error:
            raise DocumentExtractionError("DOCX thiếu document.xml hợp lệ") from error
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    blocks: list[ExtractedBlock] = []
    for paragraph in root.iter(f"{namespace}p"):
        text = "".join(node.text or "" for node in paragraph.iter(f"{namespace}t"))
        if text.strip():
            if len(blocks) >= MAX_SOURCE_BLOCKS:
                raise DocumentExtractionError("Tài liệu vượt giới hạn 1.000 khối nội dung")
            blocks.append(ExtractedBlock(text))
    return blocks


def _extract_xlsx(content: bytes) -> list[ExtractedBlock]:
    with _safe_zip(content) as archive:
        shared_strings: list[str] = []
        try:
            spreadsheet_namespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
            office_relationship_namespace = (
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
            )
            package_relationship_namespace = (
                "{http://schemas.openxmlformats.org/package/2006/relationships}"
            )
            if "xl/sharedStrings.xml" in archive.namelist():
                shared_root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
                shared_strings = [
                    "".join(node.itertext())
                    for node in shared_root.iter(f"{spreadsheet_namespace}si")
                ]
            workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
            relationships_root = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            relationships: dict[str, str] = {}
            for relationship in relationships_root.iter(
                f"{package_relationship_namespace}Relationship"
            ):
                relationship_id = relationship.get("Id")
                target = relationship.get("Target")
                relationship_type = relationship.get("Type", "")
                if (
                    relationship_id is None
                    or target is None
                    or relationship.get("TargetMode") == "External"
                    or not relationship_type.endswith("/worksheet")
                    or relationship_id in relationships
                ):
                    continue
                relationships[relationship_id] = _safe_xlsx_relationship_path(target)

            sheets = workbook.find(f"{spreadsheet_namespace}sheets")
            if sheets is None:
                raise DocumentExtractionError("XLSX thiếu danh sách worksheet")
            declared_sheets: list[tuple[str, str]] = []
            for sheet in sheets.findall(f"{spreadsheet_namespace}sheet"):
                sheet_name = sheet.get("name")
                relationship_id = sheet.get(f"{office_relationship_namespace}id")
                if sheet_name is None or relationship_id not in relationships:
                    raise DocumentExtractionError("XLSX có worksheet relationship không hợp lệ")
                declared_sheets.append((sheet_name, relationships[relationship_id]))

            blocks: list[ExtractedBlock] = []
            for sheet_name, path in declared_sheets:
                root = ElementTree.fromstring(archive.read(path))
                for row in root.iter(f"{spreadsheet_namespace}row"):
                    values: list[str] = []
                    for cell in row.iter(f"{spreadsheet_namespace}c"):
                        if cell.find(f"{spreadsheet_namespace}f") is not None:
                            continue
                        value_node = cell.find(f"{spreadsheet_namespace}v")
                        inline_node = cell.find(f"{spreadsheet_namespace}is")
                        value = "" if value_node is None else value_node.text or ""
                        if cell.get("t") == "s" and value:
                            value = shared_strings[int(value)]
                        elif inline_node is not None:
                            value = "".join(inline_node.itertext())
                        if value.strip():
                            values.append(value.strip())
                    if values:
                        if len(blocks) >= MAX_SOURCE_BLOCKS:
                            raise DocumentExtractionError(
                                "Tài liệu vượt giới hạn 1.000 khối nội dung"
                            )
                        blocks.append(ExtractedBlock(" | ".join(values), sheet_name=sheet_name))
            return blocks
        except DocumentExtractionError:
            raise
        except (IndexError, KeyError, ValueError, ElementTree.ParseError) as error:
            raise DocumentExtractionError("XLSX không hợp lệ") from error


def _safe_xlsx_relationship_path(target: str) -> str:
    if "\\" in target or target.startswith("/"):
        raise DocumentExtractionError("XLSX có worksheet path không an toàn")
    target_path = PurePosixPath(target)
    if not target_path.parts or any(part in {"", ".", ".."} for part in target_path.parts):
        raise DocumentExtractionError("XLSX có worksheet path không an toàn")
    resolved = PurePosixPath("xl") / target_path
    if resolved.parts[:2] != ("xl", "worksheets") or resolved.suffix != ".xml":
        raise DocumentExtractionError("XLSX có worksheet path không an toàn")
    return str(resolved)


def _worker_main() -> int:
    if len(sys.argv) == 4 and sys.argv[1] == "--ocr-exec-worker":
        _set_pdf_worker_resource_limits()
        os.execv(sys.argv[2], [sys.argv[2], sys.argv[3], "stdout", "--psm", "6"])
    if len(sys.argv) == 4 and sys.argv[1] == "--pdf-text-worker":
        _pdf_text_worker(Path(sys.argv[2]), Path(sys.argv[3]))
        return 0
    if len(sys.argv) == 6 and sys.argv[1] == "--pdf-render-worker":
        try:
            page_number = int(sys.argv[4])
            max_pixels = int(sys.argv[5])
        except ValueError:
            return 2
        _pdf_render_worker(
            Path(sys.argv[2]),
            Path(sys.argv[3]),
            page_number=page_number,
            max_pixels=max_pixels,
        )
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(_worker_main())
