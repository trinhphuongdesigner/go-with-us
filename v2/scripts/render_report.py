#!/usr/bin/env python3
"""Render validated CareerMate QA reports as deterministic Vietnamese artifacts."""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path
from typing import Any

from validate_report import load_report, validate


def escape(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def markdown_text(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("\\", "\\\\").replace("`", "\\`").replace("<", "&lt;").replace(">", "&gt;")


def section_list(lines: list[str], title: str, values: list[str]) -> None:
    lines.extend([f"## {title}", ""])
    lines.extend(f"- {markdown_text(value)}" for value in values) if values else lines.append("- Không có.")
    lines.append("")


def render_readme(data: dict[str, Any]) -> str:
    lines = [
        f"# {markdown_text(data['feature_name'])}", "",
        f"- **Mã tính năng:** {markdown_text(data['feature_id'])}",
        f"- **Nhánh:** {markdown_text(data['branch'])}",
        f"- **Implementation SHA:** `{markdown_text(data['implementation_sha'])}`",
        f"- **Thời điểm tạo:** {markdown_text(data['generated_at'])}",
        f"- **Kết quả:** **{markdown_text(data['overall_status'])}**", "",
        "## Giá trị sử dụng", "", markdown_text(data["user_value"]), "",
    ]
    section_list(lines, "Phạm vi", data["scope"])
    lines.extend(["## Phân rã chức năng", ""])
    for item in data["functional_breakdown"]:
        lines.append(f"{item['step']}. **{markdown_text(item['actor'])}:** {markdown_text(item['behavior'])}")
    lines.append("")
    lines.extend(["## Tiêu chí nghiệm thu", ""])
    for item in data["acceptance_criteria"]:
        evidence = ", ".join(markdown_text(value) for value in item["evidence_check_ids"]) or "Không có"
        lines.append(f"- **{markdown_text(item['id'])} · {markdown_text(item['status'])}:** {markdown_text(item['description'])} (bằng chứng: {evidence})")
    lines.append("")
    lines.extend(["## Kiểm thử và bằng chứng", ""])
    for check in data["checks"]:
        lines.extend([
            f"### {markdown_text(check['id'])} · {markdown_text(check['status'])}", "",
            f"- Loại: {markdown_text(check['category'])}",
            f"- Bắt buộc: {'Có' if check['required'] else 'Không'}",
            f"- Lệnh: `{markdown_text(check['command'])}`",
            f"- Thư mục: `{markdown_text(check['cwd'])}`",
            f"- SHA: `{markdown_text(check['exact_sha'])}`",
            f"- Kết quả: {markdown_text(check['summary'])}",
        ])
        if check.get("artifact_paths"):
            lines.append("- Artifact: " + ", ".join(f"`{markdown_text(path)}`" for path in check["artifact_paths"]))
        if check.get("metrics"):
            metrics = ", ".join(f"{markdown_text(key)}={markdown_text(value)}" for key, value in sorted(check["metrics"].items()))
            lines.append(f"- Số liệu: {metrics}")
        if check.get("blocker"):
            lines.append(f"- Blocker: {markdown_text(check['blocker'])}")
        if check.get("retry_instruction"):
            lines.append(f"- Cách chạy lại: {markdown_text(check['retry_instruction'])}")
        lines.append("")
    lines.extend(["## Review UI/UX theo persona", ""])
    for review in data["persona_reviews"]:
        lines.extend([f"### {markdown_text(review['persona'])} · {markdown_text(review['viewport'])} · {markdown_text(review['status'])}", ""])
        if review["findings"]:
            for finding in review["findings"]:
                lines.append(f"- **{markdown_text(finding['severity'])}:** {markdown_text(finding['description'])} → {markdown_text(finding['resolution'])}")
        else:
            lines.append("- Không còn finding mở trong phạm vi review.")
        lines.append("")
    section_list(lines, "API, schema và giao diện thay đổi", [f"{item['kind']} · {item['name']}: {item['change']}" for item in data.get("interfaces", [])])
    section_list(lines, "Bảo mật và quyền riêng tư", data.get("security_privacy_notes", []))
    section_list(lines, "AI và kiểm soát nguồn", data.get("ai_grounding_notes", []))
    section_list(lines, "Ảnh kiểm chứng", [f"{item['route']} · {item['viewport']} · {item['path']} · SHA {item['sha']}" for item in data.get("screenshots", [])])
    section_list(lines, "Giới hạn và việc tiếp theo", [f"{item['description']} (ảnh hưởng: {item['impact']}) → {item['next_action']}" for item in data["known_gaps"]])
    section_list(lines, "Môi trường đã che thông tin nhạy cảm", [f"{key}: {value}" for key, value in sorted(data.get("environment", {}).items())])
    return "\n".join(lines).rstrip() + "\n"


def html_list(values: list[str]) -> str:
    return "<ul>" + "".join(f"<li>{escape(value)}</li>" for value in values) + "</ul>" if values else "<p>Không có.</p>"


def render_html(data: dict[str, Any]) -> str:
    status = data["overall_status"]
    parts = [
        "<!doctype html>", '<html lang="vi"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        f"<title>{escape(data['feature_name'])} · Báo cáo QA</title><style>",
        ":root{color:#162033;background:#f7f7f3;font-family:'Be Vietnam Pro',system-ui,sans-serif}",
        "body{margin:0}.page{max-width:1120px;margin:auto;padding:40px 24px 72px}",
        "header,section{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin:0 0 16px}",
        "h1,h2,h3{line-height:1.25;margin-top:0}h2{font-size:1.25rem;color:#315e81}",
        "p,li,td,th{line-height:1.65}code{overflow-wrap:anywhere}.meta{color:#667085}",
        "table{width:100%;border-collapse:collapse}th,td{padding:12px;text-align:left;border-bottom:1px solid #e5e7eb;vertical-align:top}",
        ".badge{display:inline-block;border-radius:999px;padding:5px 10px;font-weight:700}",
        ".PASS{background:#e8f1e9;color:#45644e}.FAIL{background:#feeceb;color:#9b1c1c}",
        ".BLOCKED{background:#fff1d7;color:#7d5314}.NOT_RUN{background:#eef1f4;color:#475467}",
        ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}",
        ".card{border:1px solid #e5e7eb;border-radius:12px;padding:16px}ul{padding-left:22px}",
        "@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}</style></head><body><main class=\"page\">",
        "<header>", f"<span class=\"badge {status}\">{status}</span>", f"<h1>{escape(data['feature_name'])}</h1>",
        f"<p>{escape(data['user_value'])}</p>",
        f"<p class=\"meta\">{escape(data['feature_id'])} · {escape(data['branch'])} · <code>{escape(data['implementation_sha'])}</code> · {escape(data['generated_at'])}</p>",
        "</header><section><h2>Phạm vi</h2>", html_list(data["scope"]),
        "</section><section><h2>Phân rã chức năng</h2><ol>",
    ]
    for item in data["functional_breakdown"]:
        parts.append(f"<li><strong>{escape(item['actor'])}:</strong> {escape(item['behavior'])}</li>")
    parts.append("</ol></section><section><h2>Tiêu chí nghiệm thu</h2><table><thead><tr><th>ID</th><th>Mô tả</th><th>Trạng thái</th><th>Bằng chứng</th></tr></thead><tbody>")
    for item in data["acceptance_criteria"]:
        evidence = ", ".join(item["evidence_check_ids"]) or "Không có"
        parts.append(f"<tr><td>{escape(item['id'])}</td><td>{escape(item['description'])}</td><td><span class=\"badge {item['status']}\">{item['status']}</span></td><td>{escape(evidence)}</td></tr>")
    parts.append("</tbody></table></section><section><h2>Kiểm thử và bằng chứng</h2><div class=\"grid\">")
    for check in data["checks"]:
        parts.append("<article class=\"card\">" f"<h3>{escape(check['id'])} <span class=\"badge {check['status']}\">{check['status']}</span></h3>" f"<p><strong>{escape(check['category'])}</strong> · {'bắt buộc' if check['required'] else 'không bắt buộc'}</p>" f"<p><code>{escape(check['command'])}</code></p><p>{escape(check['summary'])}</p>" f"<p class=\"meta\"><code>{escape(check['exact_sha'])}</code></p></article>")
    parts.append("</div></section><section><h2>Review UI/UX theo persona</h2><div class=\"grid\">")
    for review in data["persona_reviews"]:
        findings = [f"{item['severity']}: {item['description']} → {item['resolution']}" for item in review["findings"]]
        parts.append(f"<article class=\"card\"><h3>{escape(review['persona'])}</h3><p>{escape(review['viewport'])} · <span class=\"badge {review['status']}\">{review['status']}</span></p>{html_list(findings)}</article>")
    parts.append("</div></section>")
    sections = [
        ("API, schema và giao diện thay đổi", [f"{x['kind']} · {x['name']}: {x['change']}" for x in data.get("interfaces", [])]),
        ("Bảo mật và quyền riêng tư", data.get("security_privacy_notes", [])),
        ("AI và kiểm soát nguồn", data.get("ai_grounding_notes", [])),
        ("Ảnh kiểm chứng", [f"{x['route']} · {x['viewport']} · {x['path']} · SHA {x['sha']}" for x in data.get("screenshots", [])]),
        ("Giới hạn và việc tiếp theo", [f"{x['description']} (ảnh hưởng: {x['impact']}) → {x['next_action']}" for x in data["known_gaps"]]),
        ("Môi trường đã che thông tin nhạy cảm", [f"{k}: {v}" for k, v in sorted(data.get("environment", {}).items())]),
    ]
    for title, values in sections:
        parts.extend([f"<section><h2>{escape(title)}</h2>", html_list(values), "</section>"])
    parts.append("</main></body></html>\n")
    return "".join(parts)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: render_report.py <qa-report.json>", file=sys.stderr)
        return 2
    report_path = Path(argv[1]).resolve()
    if not report_path.is_file():
        print(f"ERROR: report not found: {report_path}", file=sys.stderr)
        return 1
    try:
        errors = validate(report_path)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        data = load_report(report_path)
        report_path.with_name("README.md").write_text(render_readme(data), encoding="utf-8")
        report_path.with_name("report.html").write_text(render_html(data), encoding="utf-8")
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: cannot render report: {error}", file=sys.stderr)
        return 1
    print(f"PASS: rendered {report_path.parent / 'README.md'} and {report_path.parent / 'report.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
