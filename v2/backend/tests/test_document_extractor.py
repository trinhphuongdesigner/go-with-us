from __future__ import annotations

import asyncio
import io
import os
import time
import zipfile
import zlib
from dataclasses import dataclass
from pathlib import Path

import pytest
from pypdf import get_configuration

from app.services import document_extractor
from app.services.document_extractor import (
    DocumentExtractionError,
    DocumentExtractor,
    TesseractOcrExtractor,
)


def _minimal_png(width: int = 1, height: int = 1) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\rIHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x00\x00\x00\x00"
    )


class FixtureOcr:
    async def extract(self, content: bytes, *, mime_type: str) -> str:
        assert content.startswith(b"\x89PNG")
        assert mime_type == "image/png"
        return "Current role: Product Analyst"


async def test_pdf_stream_limits_are_applied_only_inside_extraction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed_limits: list[int] = []
    original = get_configuration()
    original_limits = (
        original.zlib_maximum_output_length,
        original.page_tree_maximum_depth,
        original.page_tree_maximum_entries,
        original.xform_maximum_invocations_per_extraction,
    )

    class FakePage:
        def extract_text(self, **_kwargs: object) -> str:
            configuration = get_configuration()
            observed_limits.append(configuration.zlib_maximum_output_length)
            assert configuration.page_tree_maximum_depth == 32
            assert configuration.page_tree_maximum_entries == 1_000
            assert configuration.xform_maximum_invocations_per_extraction == 100
            return "Product Analyst"

    class FakeReader:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            self.is_encrypted = False
            self.pages = [FakePage()]
            observed_limits.append(get_configuration().zlib_maximum_output_length)

    monkeypatch.setattr(document_extractor, "PdfReader", FakeReader)

    document_extractor._extract_pdf_text(b"%PDF-synthetic")

    assert observed_limits == [10 * 1024 * 1024, 10 * 1024 * 1024]
    restored = get_configuration()
    assert (
        restored.zlib_maximum_output_length,
        restored.page_tree_maximum_depth,
        restored.page_tree_maximum_entries,
        restored.xform_maximum_invocations_per_extraction,
    ) == original_limits


async def test_pdf_rejects_aggregate_decoded_streams_before_extracting_over_budget_page(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    extracted_pages: list[int] = []

    class FakeStream:
        def __init__(self, size: int) -> None:
            self.size = size

        def get_data(self) -> bytes:
            return b"x" * self.size

        def get(self, _key: str) -> None:
            return None

    class FakePage:
        def __init__(self, page_number: int) -> None:
            self.page_number = page_number
            self.stream = FakeStream(9 * 1024 * 1024)

        def raw_get(self, key: str) -> FakeStream:
            assert key == "/Contents"
            return self.stream

        def get(self, _key: str) -> None:
            return None

        def extract_text(self, **_kwargs: object) -> str:
            extracted_pages.append(self.page_number)
            return f"Page {self.page_number}"

    class FakeReader:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            self.is_encrypted = False
            self.pages = [FakePage(1), FakePage(2), FakePage(3)]

    monkeypatch.setattr(document_extractor, "PdfReader", FakeReader)

    with pytest.raises(DocumentExtractionError, match="tổng dữ liệu giải nén"):
        document_extractor._extract_pdf_text(b"%PDF-synthetic")

    assert extracted_pages == [1, 2]


async def test_pdf_counts_inherited_form_streams_in_aggregate_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    extracted_pages: list[int] = []

    class FakeStream:
        def __init__(self, size: int, *, subtype: str | None = None) -> None:
            self.size = size
            self.subtype = subtype

        def get_data(self) -> bytes:
            return b"x" * self.size

        def get(self, key: str) -> str | None:
            return self.subtype if key == "/Subtype" else None

    forms = {f"/Fm{index}": FakeStream(9 * 1024 * 1024, subtype="/Form") for index in range(3)}

    class FakePage:
        def raw_get(self, key: str) -> FakeStream:
            assert key == "/Contents"
            return FakeStream(1)

        def get_inherited(self, *, key: str, default: object) -> object:
            assert key == "/Resources"
            return {"/XObject": forms}

        def extract_text(self, **_kwargs: object) -> str:
            extracted_pages.append(1)
            return "Page 1"

    class FakeReader:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            self.is_encrypted = False
            self.pages = [FakePage()]

    monkeypatch.setattr(document_extractor, "PdfReader", FakeReader)

    with pytest.raises(DocumentExtractionError, match="tổng dữ liệu giải nén"):
        document_extractor._extract_pdf_text(b"%PDF-synthetic")

    assert extracted_pages == []


async def test_pdf_text_budget_escapes_swallowed_nested_form_callback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    operand_calls = 0

    class FakePage:
        def raw_get(self, key: str) -> None:
            assert key == "/Contents"

        def get_inherited(self, *, key: str, default: object) -> object:
            assert key == "/Resources"
            return default

        def extract_text(self, **kwargs: object) -> str:
            nonlocal operand_calls
            visitor_text = kwargs["visitor_text"]
            visitor_operand_before = kwargs["visitor_operand_before"]
            assert callable(visitor_text)
            assert callable(visitor_operand_before)
            try:
                visitor_text(
                    "x" * (document_extractor.MAX_EXTRACTED_CHARS + 1), None, None, None, None
                )
            except DocumentExtractionError:
                pass  # Mirrors pypdf swallowing errors raised inside a Form XObject.
            operand_calls += 1
            visitor_operand_before(b"Do", [], None, None)
            raise AssertionError("budget guard must abort before the next repeated Form")

    class FakeReader:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            self.is_encrypted = False
            self.pages = [FakePage()]

    monkeypatch.setattr(document_extractor, "PdfReader", FakeReader)

    with pytest.raises(DocumentExtractionError, match="Nội dung trích xuất vượt giới hạn"):
        document_extractor._extract_pdf_text(b"%PDF-synthetic")

    assert operand_calls == 1


def _zip(parts: dict[str, str]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in parts.items():
            archive.writestr(name, value)
    return output.getvalue()


def _minimal_pdf(text: str | list[str]) -> bytes:
    texts = [text] if isinstance(text, str) else text
    font_id = 3 + len(texts) * 2
    kids = " ".join(f"{3 + index * 2} 0 R" for index in range(len(texts)))
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{kids}] /Count {len(texts)} >>".encode(),
    ]
    for index, page_text in enumerate(texts):
        stream_id = 4 + index * 2
        stream = f"BT /F1 12 Tf 20 80 Td ({page_text}) Tj ET".encode()
        objects.extend(
            [
                (
                    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] "
                    + f"/Resources << /Font << /F1 {font_id} 0 R >> >> ".encode()
                    + f"/Contents {stream_id} 0 R >>".encode()
                ),
                b"<< /Length "
                + str(len(stream)).encode()
                + b" >>\nstream\n"
                + stream
                + b"\nendstream",
            ]
        )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    payload = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(payload))
        payload.extend(f"{index} 0 obj\n".encode())
        payload.extend(obj)
        payload.extend(b"\nendobj\n")
    xref = len(payload)
    payload.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    payload.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        payload.extend(f"{offset:010d} 00000 n \n".encode())
    payload.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(payload)


def _minimal_scanned_pdf() -> bytes:
    draw_stream = b"q 100 0 0 100 0 0 cm /Im0 Do Q"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] "
            b"/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>"
        ),
        b"<< /Length "
        + str(len(draw_stream)).encode()
        + b" >>\nstream\n"
        + draw_stream
        + b"\nendstream",
        (
            b"<< /Type /XObject /Subtype /Image /Width 1 /Height 1 "
            b"/ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n"
            b"\x00\nendstream"
        ),
    ]
    payload = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(payload))
        payload.extend(f"{index} 0 obj\n".encode())
        payload.extend(obj)
        payload.extend(b"\nendobj\n")
    xref = len(payload)
    payload.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    payload.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        payload.extend(f"{offset:010d} 00000 n \n".encode())
    payload.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(payload)


def _compressed_xref_amplifier(entry_count: int = 2_000_000) -> bytes:
    payload = bytearray(b"%PDF-1.5\n")
    payload.extend(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    payload.extend(b"2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n")
    xref_offset = len(payload)
    encoded_entries = zlib.compress(b"\x01\x00\x00" * entry_count, level=9)
    payload.extend(
        (
            f"3 0 obj\n<< /Type /XRef /Size {entry_count} /W [1 1 1] "
            f"/Index [0 {entry_count}] /Root 1 0 R /Filter /FlateDecode "
            f"/Length {len(encoded_entries)} >>\nstream\n"
        ).encode()
    )
    payload.extend(encoded_entries)
    payload.extend(f"\nendstream\nendobj\nstartxref\n{xref_offset}\n%%EOF\n".encode())
    return bytes(payload)


async def test_pdf_page_tree_limit_fails_before_application_page_count_check() -> None:
    oversized_tree = _minimal_pdf([""] * (document_extractor.MAX_PDF_PAGE_TREE_ENTRIES + 1))

    with pytest.raises(DocumentExtractionError, match="PDF không hợp lệ"):
        await DocumentExtractor().extract("career.pdf", "application/pdf", oversized_tree)


async def test_pdf_xref_amplification_is_terminated_inside_bounded_worker() -> None:
    started = time.monotonic()

    with pytest.raises(DocumentExtractionError, match="bộ nhớ|thời gian|kết thúc"):
        await DocumentExtractor().extract(
            "career.pdf", "application/pdf", _compressed_xref_amplifier()
        )

    assert time.monotonic() - started < document_extractor.PDF_WORKER_WALL_SECONDS + 1


def _write_fixture_worker(tmp_path: Path, *, sleep_seconds: float, write_result: bool) -> Path:
    script = tmp_path / "fixture_pdf_worker.py"
    result_line = (
        "Path(sys.argv[3]).write_text(json.dumps({'status': 'ok', 'blocks': []}))"
        if write_result
        else "pass"
    )
    script.write_text(
        "\n".join(
            [
                "import json",
                "import sys",
                "import time",
                "from pathlib import Path",
                f"time.sleep({sleep_seconds!r})",
                result_line,
            ]
        ),
        encoding="utf-8",
    )
    return script


async def test_pdf_worker_concurrency_is_bounded_per_event_loop(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    worker = _write_fixture_worker(tmp_path, sleep_seconds=0.15, write_result=True)
    monkeypatch.setattr(document_extractor, "PDF_WORKER_SCRIPT_PATH", worker)
    tasks = [
        asyncio.create_task(document_extractor._run_isolated_pdf_worker(b"%PDF", "text"))
        for _ in range(5)
    ]
    peak_active = 0
    while not all(task.done() for task in tasks):
        peak_active = max(peak_active, len(document_extractor._ACTIVE_PDF_WORKER_PIDS))
        await asyncio.sleep(0.01)

    responses = await asyncio.gather(*tasks)

    assert len(responses) == 5
    assert peak_active == document_extractor.PDF_WORKER_CONCURRENCY
    assert document_extractor._ACTIVE_PDF_WORKER_PIDS == set()


async def test_cancelling_render_worker_kills_reaps_and_releases_capacity(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    worker = _write_fixture_worker(tmp_path, sleep_seconds=30, write_result=False)
    monkeypatch.setattr(document_extractor, "PDF_WORKER_SCRIPT_PATH", worker)
    task = asyncio.create_task(
        document_extractor._run_isolated_pdf_worker(
            b"%PDF", "render", page_number=1, max_pixels=100
        )
    )
    for _ in range(100):
        if document_extractor._ACTIVE_PDF_WORKER_PIDS:
            break
        await asyncio.sleep(0.01)
    process_id = next(iter(document_extractor._ACTIVE_PDF_WORKER_PIDS))

    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert process_id not in document_extractor._ACTIVE_PDF_WORKER_PIDS
    with pytest.raises(ProcessLookupError):
        os.kill(process_id, 0)


async def test_hanging_render_worker_is_killed_and_reaped_on_wall_timeout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    worker = _write_fixture_worker(tmp_path, sleep_seconds=30, write_result=False)
    monkeypatch.setattr(document_extractor, "PDF_WORKER_SCRIPT_PATH", worker)
    monkeypatch.setattr(document_extractor, "PDF_WORKER_WALL_SECONDS", 0.15)

    with pytest.raises(DocumentExtractionError, match="thời gian"):
        await document_extractor._run_isolated_pdf_worker(
            b"%PDF", "render", page_number=1, max_pixels=100
        )

    assert document_extractor._ACTIVE_PDF_WORKER_PIDS == set()


def _xlsx_parts(sheets: list[tuple[str, str, str]]) -> dict[str, str]:
    workbook_sheets = "".join(
        f'<sheet name="{name}" sheetId="{index}" r:id="{relationship_id}"/>'
        for index, (name, relationship_id, _target) in enumerate(sheets, start=1)
    )
    relationships = "".join(
        (
            f'<Relationship Id="{relationship_id}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
            f'worksheet" Target="{target}"/>'
        )
        for _name, relationship_id, target in reversed(sheets)
    )
    parts = {
        "xl/workbook.xml": (
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f"<sheets>{workbook_sheets}</sheets></workbook>"
        ),
        "xl/_rels/workbook.xml.rels": (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
            f'relationships">{relationships}</Relationships>'
        ),
    }
    for index, (_name, _relationship_id, target) in enumerate(sheets, start=1):
        parts[f"xl/{target}"] = (
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>value-{index}</t>'
            "</is></c></row></sheetData></worksheet>"
        )
    return parts


@pytest.mark.parametrize(
    ("filename", "mime_type", "content", "expected", "page", "sheet"),
    [
        ("career.txt", "text/plain", b"Current role: Analyst", "Current role: Analyst", None, None),
        (
            "career.csv",
            "text/csv",
            b"field,value\nrole,Product Analyst\n",
            "role | Product Analyst",
            None,
            None,
        ),
        (
            "career.pdf",
            "application/pdf",
            _minimal_pdf("Product Analyst"),
            "Product Analyst",
            1,
            None,
        ),
        (
            "career.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            _zip(
                {
                    "word/document.xml": (
                        '<w:document xmlns:w="http://schemas.openxmlformats.org/'
                        'wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'
                        "Product Analyst</w:t></w:r></w:p></w:body></w:document>"
                    )
                }
            ),
            "Product Analyst",
            None,
            None,
        ),
        (
            "career.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            _zip(
                {
                    **_xlsx_parts([("Experience", "rId9", "worksheets/custom.xml")]),
                    "xl/worksheets/custom.xml": (
                        '<worksheet xmlns="http://schemas.openxmlformats.org/'
                        'spreadsheetml/2006/main"><sheetData><row r="1">'
                        '<c r="A1" t="inlineStr"><is><t>Product Analyst</t></is></c>'
                        "</row></sheetData></worksheet>"
                    ),
                }
            ),
            "Product Analyst",
            None,
            "Experience",
        ),
        (
            "career.png",
            "image/png",
            _minimal_png(),
            "Product Analyst",
            None,
            None,
        ),
    ],
)
async def test_supported_documents_extract_ordered_text_blocks(
    filename: str,
    mime_type: str,
    content: bytes,
    expected: str,
    page: int | None,
    sheet: str | None,
) -> None:
    _, blocks = await DocumentExtractor(FixtureOcr()).extract(filename, mime_type, content)

    matched = next(block for block in blocks if expected in block.text)
    assert matched.page_number == page
    assert matched.sheet_name == sheet


@pytest.mark.parametrize(
    ("filename", "mime_type", "content"),
    [
        ("career.pdf", "application/pdf", b"not-a-pdf"),
        ("career.docx", "application/zip", b"PK\x03\x04"),
        ("career.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12", b"PK\x03\x04"),
        ("career.png", "image/jpeg", b"\x89PNG\r\n\x1a\nfixture"),
    ],
)
async def test_mime_extension_and_magic_mismatches_fail_closed(
    filename: str, mime_type: str, content: bytes
) -> None:
    with pytest.raises(DocumentExtractionError):
        await DocumentExtractor(FixtureOcr()).extract(filename, mime_type, content)


async def test_extracted_text_is_canonicalized_to_nfc_before_consumers_hash_or_slice_it() -> None:
    _, blocks = await DocumentExtractor().extract("career.txt", "text/plain", "Cafe\u0301".encode())

    assert blocks[0].text == "Caf\u00e9"
    assert document_extractor.canonicalize_text("Cafe\u0301\r\n") == "Caf\u00e9\n"


async def test_xlsx_uses_declared_sheet_order_relationship_targets_and_actual_names() -> None:
    sheets = [
        (f"Custom {index}", f"rId{20 - index}", f"worksheets/custom-{index}.xml")
        for index in range(12, 0, -1)
    ]

    _, blocks = await DocumentExtractor().extract(
        "career.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        _zip(_xlsx_parts(sheets)),
    )

    assert [block.sheet_name for block in blocks] == [name for name, _rid, _target in sheets]
    assert [block.text for block in blocks] == [f"value-{index}" for index in range(1, 13)]


async def test_xlsx_rejects_relationship_targets_that_escape_the_workbook_directory() -> None:
    parts = _xlsx_parts([("Unsafe", "rId1", "worksheets/safe.xml")])
    parts["xl/_rels/workbook.xml.rels"] = parts["xl/_rels/workbook.xml.rels"].replace(
        'Target="worksheets/safe.xml"', 'Target="../word/document.xml"'
    )
    parts["word/document.xml"] = parts.pop("xl/worksheets/safe.xml")

    with pytest.raises(DocumentExtractionError, match="XLSX"):
        await DocumentExtractor().extract(
            "career.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            _zip(parts),
        )


def _write_fake_ocr(tmp_path: Path, body: str) -> Path:
    executable = tmp_path / "fake_tesseract"
    executable.write_text("#!/usr/bin/env python3\n" + body, encoding="utf-8")
    executable.chmod(0o700)
    return executable


async def test_tesseract_returns_bounded_utf8_output_from_isolated_worker(tmp_path: Path) -> None:
    executable = _write_fake_ocr(tmp_path, 'print("Current role: Product Analyst")\n')

    result = await TesseractOcrExtractor(executable=str(executable)).extract(
        _minimal_png(), mime_type="image/png"
    )

    assert result == "Current role: Product Analyst"
    assert document_extractor._ACTIVE_PDF_WORKER_PIDS == set()


async def test_tesseract_rejects_oversized_output_and_reaps_worker(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(document_extractor, "MAX_OCR_OUTPUT_BYTES", 1_024)
    executable = _write_fake_ocr(tmp_path, 'import sys\nsys.stdout.write("x" * 4096)\n')

    with pytest.raises(DocumentExtractionError, match="OCR output vượt giới hạn"):
        await TesseractOcrExtractor(executable=str(executable)).extract(
            _minimal_png(), mime_type="image/png"
        )

    assert document_extractor._ACTIVE_PDF_WORKER_PIDS == set()


async def test_tesseract_timeout_kills_and_reaps_real_process(tmp_path: Path) -> None:
    executable = _write_fake_ocr(tmp_path, "import time\ntime.sleep(30)\n")

    with pytest.raises(DocumentExtractionError, match="OCR.*thời gian"):
        await TesseractOcrExtractor(executable=str(executable), timeout_seconds=0.15).extract(
            _minimal_png(), mime_type="image/png"
        )

    assert document_extractor._ACTIVE_PDF_WORKER_PIDS == set()


async def test_tesseract_cancellation_kills_and_reaps_real_process(tmp_path: Path) -> None:
    executable = _write_fake_ocr(tmp_path, "import time\ntime.sleep(30)\n")
    task = asyncio.create_task(
        TesseractOcrExtractor(executable=str(executable)).extract(
            _minimal_png(), mime_type="image/png"
        )
    )
    for _ in range(100):
        if document_extractor._ACTIVE_PDF_WORKER_PIDS:
            break
        await asyncio.sleep(0.01)
    process_id = next(iter(document_extractor._ACTIVE_PDF_WORKER_PIDS))

    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert process_id not in document_extractor._ACTIVE_PDF_WORKER_PIDS
    with pytest.raises(ProcessLookupError):
        os.kill(process_id, 0)


async def test_tesseract_concurrency_shares_pdf_worker_capacity(tmp_path: Path) -> None:
    executable = _write_fake_ocr(
        tmp_path, 'import time\ntime.sleep(0.15)\nprint("Product Analyst")\n'
    )
    extractor = TesseractOcrExtractor(executable=str(executable))
    tasks = [
        asyncio.create_task(extractor.extract(_minimal_png(), mime_type="image/png"))
        for _ in range(5)
    ]
    peak_active = 0
    while not all(task.done() for task in tasks):
        peak_active = max(peak_active, len(document_extractor._ACTIVE_PDF_WORKER_PIDS))
        await asyncio.sleep(0.01)

    assert await asyncio.gather(*tasks) == ["Product Analyst"] * 5
    assert peak_active == document_extractor.PDF_WORKER_CONCURRENCY
    assert document_extractor._ACTIVE_PDF_WORKER_PIDS == set()


@pytest.mark.parametrize(
    ("filename", "mime_type", "content"),
    [
        ("oversized.png", "image/png", _minimal_png(4_001, 1_000)),
        (
            "oversized.jpg",
            "image/jpeg",
            b"\xff\xd8\xff\xc0\x00\x07\x08\x03\xe8\x0f\xa1",
        ),
        (
            "oversized.webp",
            "image/webp",
            b"RIFF\x16\x00\x00\x00WEBPVP8X\x0a\x00\x00\x00\x00\x00\x00\x00"
            + (4_001 - 1).to_bytes(3, "little")
            + (1_000 - 1).to_bytes(3, "little"),
        ),
    ],
)
async def test_direct_image_ocr_rejects_decompression_bomb_dimensions(
    filename: str, mime_type: str, content: bytes
) -> None:
    with pytest.raises(DocumentExtractionError, match="điểm ảnh"):
        await DocumentExtractor(FixtureOcr()).extract(filename, mime_type, content)


class RecordingOcr:
    def __init__(self, *, result: str = "Scanned role", wait_forever: bool = False) -> None:
        self.result = result
        self.wait_forever = wait_forever
        self.calls: list[tuple[bytes, str]] = []

    async def extract(self, content: bytes, *, mime_type: str) -> str:
        self.calls.append((content, mime_type))
        if self.wait_forever:
            await asyncio.Future()
        return self.result


@dataclass(frozen=True)
class FixtureRenderedPdfPage:
    content: bytes
    mime_type: str
    pixel_count: int


class FixturePdfRenderer:
    def __init__(self, pages: list[FixtureRenderedPdfPage]) -> None:
        self.pages = pages
        self.calls: list[tuple[int, int]] = []

    def render_page(
        self, content: bytes, *, page_number: int, max_pixels: int
    ) -> FixtureRenderedPdfPage:
        assert content.startswith(b"%PDF-")
        self.calls.append((page_number, max_pixels))
        return self.pages[page_number - 1]


async def test_scanned_pdf_pages_are_rasterized_and_ocr_keeps_page_numbers() -> None:
    ocr = RecordingOcr()
    renderer = FixturePdfRenderer(
        [FixtureRenderedPdfPage(b"png-page-1", "image/png", pixel_count=100)]
    )

    _, blocks = await DocumentExtractor(ocr, pdf_renderer=renderer).extract(
        "scan.pdf", "application/pdf", _minimal_pdf("")
    )

    assert [(block.text, block.page_number) for block in blocks] == [("Scanned role", 1)]
    assert ocr.calls == [(b"png-page-1", "image/png")]
    assert renderer.calls == [(1, document_extractor.MAX_PDF_OCR_PAGE_PIXELS)]


async def test_default_pdf_renderer_produces_bounded_grayscale_image_for_ocr() -> None:
    ocr = RecordingOcr()

    _, blocks = await DocumentExtractor(ocr).extract(
        "scan.pdf", "application/pdf", _minimal_scanned_pdf()
    )

    assert blocks[0].page_number == 1
    assert ocr.calls[0][0].startswith(b"P5\n")
    assert ocr.calls[0][1] == "image/x-portable-graymap"


async def test_scanned_pdf_ocr_rejects_more_than_the_page_cap() -> None:
    renderer = FixturePdfRenderer([])

    with pytest.raises(DocumentExtractionError, match="OCR.*trang"):
        await DocumentExtractor(RecordingOcr(), pdf_renderer=renderer).extract(
            "scan.pdf",
            "application/pdf",
            _minimal_pdf([""] * (document_extractor.MAX_PDF_OCR_PAGES + 1)),
        )
    assert renderer.calls == []


@pytest.mark.parametrize(
    "rendered_page",
    [
        FixtureRenderedPdfPage(b"small", "image/png", pixel_count=4_000_001),
        FixtureRenderedPdfPage(b"x" * 101, "image/png", pixel_count=100),
    ],
)
async def test_scanned_pdf_ocr_enforces_pixel_and_rendered_byte_caps(
    monkeypatch: pytest.MonkeyPatch, rendered_page: FixtureRenderedPdfPage
) -> None:
    monkeypatch.setattr(document_extractor, "MAX_PDF_OCR_PAGE_PIXELS", 4_000_000)
    monkeypatch.setattr(document_extractor, "MAX_PDF_OCR_TOTAL_BYTES", 100)
    renderer = FixturePdfRenderer([rendered_page])

    with pytest.raises(DocumentExtractionError, match="OCR.*giới hạn"):
        await DocumentExtractor(RecordingOcr(), pdf_renderer=renderer).extract(
            "scan.pdf", "application/pdf", _minimal_pdf("")
        )


async def test_scanned_pdf_ocr_enforces_total_time_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(document_extractor, "MAX_PDF_OCR_SECONDS", 0.01)
    renderer = FixturePdfRenderer(
        [FixtureRenderedPdfPage(b"png-page-1", "image/png", pixel_count=100)]
    )

    with pytest.raises(DocumentExtractionError, match="OCR.*thời gian"):
        await DocumentExtractor(RecordingOcr(wait_forever=True), pdf_renderer=renderer).extract(
            "scan.pdf", "application/pdf", _minimal_pdf("")
        )
