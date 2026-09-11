#!/usr/bin/env python3
"""Validate CareerMate feature reports with fail-closed stdlib checks."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

REQUIRED_TOP = {
    "schema_version",
    "report_language",
    "feature_id",
    "feature_name",
    "branch",
    "implementation_sha",
    "generated_at",
    "scope",
    "user_value",
    "functional_breakdown",
    "acceptance_criteria",
    "checks",
    "persona_reviews",
    "known_gaps",
    "overall_status",
}
ALLOWED_TOP = REQUIRED_TOP | {
    "verified_tree_sha",
    "environment",
    "interfaces",
    "security_privacy_notes",
    "ai_grounding_notes",
    "screenshots",
}
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
FEATURE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
CHECK_ID_RE = re.compile(r"^CHK-[A-Z0-9-]+$")
AC_ID_RE = re.compile(r"^AC-[0-9]{2,}$")
VIEWPORT_RE = re.compile(r"^[0-9]+x[0-9]+$")
STATUSES = {"PASS", "FAIL", "BLOCKED", "NOT_RUN"}
PERSONAS = {"EMPLOYEE_22_30", "HR_35_45", "MANAGER_45_55", "LOW_TECH_USER"}
CATEGORIES = {
    "FORMAT",
    "LINT",
    "TYPECHECK",
    "UNIT",
    "INTEGRATION",
    "CONTRACT",
    "MIGRATION",
    "E2E",
    "ACCESSIBILITY",
    "SECURITY",
    "PERFORMANCE",
    "AI_GROUNDING",
    "MANUAL_UI",
    "BUILD",
    "PUSH",
}
REQUIRED_PASS_CATEGORIES = {
    "FORMAT",
    "LINT",
    "TYPECHECK",
    "UNIT",
    "INTEGRATION",
    "CONTRACT",
    "MIGRATION",
    "E2E",
    "ACCESSIBILITY",
    "SECURITY",
    "PERFORMANCE",
    "MANUAL_UI",
    "BUILD",
}
INTERFACE_KINDS = {"API", "DATABASE", "EVENT", "AI_SCHEMA", "UI_ROUTE"}
SEVERITIES = {"P0", "P1", "P2"}
IMPACTS = {"LOW", "MEDIUM", "HIGH"}
FUNCTIONAL_KEYS = {"step", "actor", "behavior"}
AC_KEYS = {"id", "description", "status", "evidence_check_ids"}
CHECK_KEYS = {
    "id", "category", "required", "status", "command", "cwd", "started_at",
    "finished_at", "exit_code", "exact_sha", "summary", "artifact_paths", "metrics",
    "blocker", "retry_instruction",
}
PERSONA_KEYS = {"persona", "viewport", "status", "findings"}
FINDING_KEYS = {"severity", "description", "resolution"}
INTERFACE_KEYS = {"kind", "name", "change"}
SCREENSHOT_KEYS = {"path", "route", "viewport", "sha"}
GAP_KEYS = {"description", "impact", "next_action"}
ENVIRONMENT_KEYS = {"os", "python", "node", "browser", "database", "ai_provider"}


def load_report(path: Path) -> dict[str, Any]:
    parsed = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("report root must be an object")
    return parsed


def is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def is_iso_datetime(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    candidate = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        datetime.fromisoformat(candidate)
    except ValueError:
        return False
    return True


def reject_unknown(item: dict[str, Any], allowed: set[str], path: str, errors: list[str]) -> None:
    for key in sorted(item.keys() - allowed):
        errors.append(f"unknown field {path}.{key}")


def git_output(repo_root: Path, *arguments: str) -> str:
    """Run a read-only Git query and return its trimmed stdout."""

    result = subprocess.run(
        ["git", "-C", str(repo_root), *arguments],
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or "Git query failed"
        raise ValueError(detail)
    return result.stdout.strip()


def validate_git_binding(data: dict[str, Any], repo_root: Path) -> list[str]:
    """Bind claimed evidence to a real commit and its immutable tree."""

    errors: list[str] = []
    implementation_sha = data.get("implementation_sha")
    if not SHA_RE.fullmatch(str(implementation_sha or "")):
        return errors

    try:
        git_output(repo_root, "cat-file", "-e", f"{implementation_sha}^{{commit}}")
    except ValueError:
        return ["implementation_sha must identify an existing Git commit"]

    try:
        head_sha = git_output(repo_root, "rev-parse", "HEAD")
        git_output(repo_root, "merge-base", "--is-ancestor", str(implementation_sha), head_sha)
    except ValueError:
        errors.append("implementation_sha must be an ancestor of the current HEAD")
        head_sha = ""

    verified_tree_sha = data.get("verified_tree_sha")
    if verified_tree_sha is None:
        if data.get("overall_status") == "PASS":
            errors.append("overall PASS requires verified_tree_sha")
        return errors

    if not SHA_RE.fullmatch(str(verified_tree_sha)):
        return errors

    try:
        expected_tree_sha = git_output(repo_root, "rev-parse", f"{implementation_sha}^{{tree}}")
        git_output(repo_root, "cat-file", "-e", f"{verified_tree_sha}^{{tree}}")
    except ValueError:
        errors.append("verified_tree_sha must identify an existing Git tree")
        return errors

    if verified_tree_sha != expected_tree_sha:
        errors.append("verified_tree_sha must match the implementation commit tree")
    return errors


def validate(report_path: Path) -> list[str]:
    data = load_report(report_path)
    errors: list[str] = []

    for key in sorted(REQUIRED_TOP - data.keys()):
        errors.append(f"missing required top-level field: {key}")
    for key in sorted(data.keys() - ALLOWED_TOP):
        errors.append(f"unknown top-level field: {key}")

    if data.get("schema_version") != "1.0":
        errors.append("schema_version must be exactly '1.0'")
    if data.get("report_language") != "vi":
        errors.append("report_language must be exactly 'vi'")
    if not FEATURE_ID_RE.fullmatch(str(data.get("feature_id", ""))):
        errors.append("feature_id must match ^[a-z0-9][a-z0-9-]*$")
    for key in ("feature_name", "branch", "user_value"):
        if not is_non_empty_string(data.get(key)):
            errors.append(f"{key} must be a non-empty string")

    implementation_sha = data.get("implementation_sha")
    if not SHA_RE.fullmatch(str(implementation_sha or "")):
        errors.append("implementation_sha must be 40 lowercase hex characters")
    verified_tree_sha = data.get("verified_tree_sha")
    if verified_tree_sha is not None and not SHA_RE.fullmatch(str(verified_tree_sha)):
        errors.append("verified_tree_sha must be null or 40 lowercase hex characters")
    if not is_iso_datetime(data.get("generated_at")):
        errors.append("generated_at must be an ISO date-time")

    scope = data.get("scope")
    if not isinstance(scope, list) or not scope or not all(is_non_empty_string(item) for item in scope):
        errors.append("scope must be a non-empty string array")

    breakdown = data.get("functional_breakdown")
    if not isinstance(breakdown, list) or not breakdown:
        errors.append("functional_breakdown must be a non-empty array")
    else:
        for index, item in enumerate(breakdown):
            if not isinstance(item, dict):
                errors.append(f"functional_breakdown[{index}] must be an object")
                continue
            reject_unknown(item, FUNCTIONAL_KEYS, f"functional_breakdown[{index}]", errors)
            if not isinstance(item.get("step"), int) or item["step"] < 1:
                errors.append(f"functional_breakdown[{index}].step must be >= 1")
            for key in ("actor", "behavior"):
                if not is_non_empty_string(item.get(key)):
                    errors.append(f"functional_breakdown[{index}].{key} must be non-empty")

    check_ids: set[str] = set()
    check_statuses: dict[str, str] = {}
    required_check_statuses: list[str] = []
    passed_required_categories: set[str] = set()
    checks = data.get("checks")
    if not isinstance(checks, list) or not checks:
        errors.append("checks must be a non-empty array")
        checks = []
    for index, check in enumerate(checks):
        if not isinstance(check, dict):
            errors.append(f"checks[{index}] must be an object")
            continue
        reject_unknown(check, CHECK_KEYS, f"checks[{index}]", errors)
        check_id = str(check.get("id", ""))
        if not CHECK_ID_RE.fullmatch(check_id):
            errors.append(f"checks[{index}].id must match ^CHK-[A-Z0-9-]+$")
        elif check_id in check_ids:
            errors.append(f"duplicate check id: {check_id}")
        check_ids.add(check_id)
        if check.get("category") not in CATEGORIES:
            errors.append(f"check {check_id} has invalid category")
        if not isinstance(check.get("required"), bool):
            errors.append(f"check {check_id}.required must be boolean")
        status = check.get("status")
        if status not in STATUSES:
            errors.append(f"check {check_id} has invalid status: {status}")
        elif CHECK_ID_RE.fullmatch(check_id):
            check_statuses[check_id] = str(status)
        if check.get("required") is True:
            required_check_statuses.append(str(status))
            if status == "PASS" and check.get("category") in CATEGORIES:
                passed_required_categories.add(str(check["category"]))
        if check.get("exact_sha") != implementation_sha:
            errors.append(f"check {check_id} exact_sha mismatch")
        if not is_non_empty_string(check.get("command")):
            errors.append(f"check {check_id}.command must be non-empty")
        if not is_non_empty_string(check.get("cwd")):
            errors.append(f"check {check_id}.cwd must be non-empty")
        if not is_non_empty_string(check.get("summary")):
            errors.append(f"check {check_id}.summary must be non-empty")
        if not isinstance(check.get("artifact_paths"), list):
            errors.append(f"check {check_id}.artifact_paths must be an array")
        elif not all(is_non_empty_string(path) for path in check["artifact_paths"]):
            errors.append(f"check {check_id}.artifact_paths must contain non-empty strings")
        elif len(check["artifact_paths"]) != len(set(check["artifact_paths"])):
            errors.append(f"check {check_id}.artifact_paths must be unique")
        metrics = check.get("metrics", {})
        if not isinstance(metrics, dict) or not all(
            is_non_empty_string(key) and isinstance(value, (str, int, float, bool, type(None)))
            for key, value in metrics.items()
        ):
            errors.append(f"check {check_id}.metrics must contain scalar values")
        if status in {"PASS", "FAIL"}:
            if not is_iso_datetime(check.get("started_at")) or not is_iso_datetime(check.get("finished_at")):
                errors.append(f"{status} check {check_id} requires valid start and finish times")
            exit_code = check.get("exit_code")
            if not isinstance(exit_code, int):
                errors.append(f"{status} check {check_id} requires an integer exit_code")
            elif status == "PASS" and exit_code != 0:
                errors.append(f"PASS check {check_id} must have exit_code 0")
            elif status == "FAIL" and exit_code == 0:
                errors.append(f"FAIL check {check_id} must have a non-zero exit_code")
        if status == "BLOCKED" and (
            not is_non_empty_string(check.get("blocker"))
            or not is_non_empty_string(check.get("retry_instruction"))
        ):
            errors.append(f"BLOCKED check {check_id} requires blocker and retry_instruction")

    acceptance_statuses: list[str] = []
    acceptance = data.get("acceptance_criteria")
    if not isinstance(acceptance, list) or not acceptance:
        errors.append("acceptance_criteria must be a non-empty array")
        acceptance = []
    acceptance_ids: set[str] = set()
    for index, criterion in enumerate(acceptance):
        if not isinstance(criterion, dict):
            errors.append(f"acceptance_criteria[{index}] must be an object")
            continue
        reject_unknown(criterion, AC_KEYS, f"acceptance_criteria[{index}]", errors)
        criterion_id = str(criterion.get("id", ""))
        if not AC_ID_RE.fullmatch(criterion_id):
            errors.append(f"acceptance_criteria[{index}].id is invalid")
        elif criterion_id in acceptance_ids:
            errors.append(f"duplicate acceptance criterion id: {criterion_id}")
        acceptance_ids.add(criterion_id)
        if not is_non_empty_string(criterion.get("description")):
            errors.append(f"criterion {criterion_id}.description must be non-empty")
        status = criterion.get("status")
        if status not in STATUSES:
            errors.append(f"criterion {criterion_id} has invalid status")
        acceptance_statuses.append(str(status))
        evidence_ids = criterion.get("evidence_check_ids")
        if not isinstance(evidence_ids, list):
            errors.append(f"criterion {criterion_id}.evidence_check_ids must be an array")
            continue
        if len(evidence_ids) != len(set(evidence_ids)):
            errors.append(f"criterion {criterion_id} repeats evidence check ids")
        if status == "PASS" and not evidence_ids:
            errors.append(f"PASS criterion {criterion_id} requires evidence check ids")
        for evidence_id in evidence_ids:
            if evidence_id not in check_ids:
                errors.append(f"criterion {criterion_id} references unknown check id: {evidence_id}")
            elif status == "PASS" and check_statuses.get(str(evidence_id)) != "PASS":
                errors.append(
                    f"PASS criterion {criterion_id} may reference only PASS checks: {evidence_id}"
                )

    persona_statuses: list[str] = []
    personas = data.get("persona_reviews")
    if not isinstance(personas, list) or len(personas) < 4:
        errors.append("persona_reviews must contain all four required personas")
        personas = []
    seen_personas: set[str] = set()
    for index, review in enumerate(personas):
        if not isinstance(review, dict):
            errors.append(f"persona_reviews[{index}] must be an object")
            continue
        reject_unknown(review, PERSONA_KEYS, f"persona_reviews[{index}]", errors)
        persona = str(review.get("persona", ""))
        if persona not in PERSONAS:
            errors.append(f"invalid persona: {persona}")
        elif persona in seen_personas:
            errors.append(f"duplicate persona: {persona}")
        seen_personas.add(persona)
        if not VIEWPORT_RE.fullmatch(str(review.get("viewport", ""))):
            errors.append(f"invalid viewport for persona {persona}")
        status = review.get("status")
        if status not in STATUSES:
            errors.append(f"invalid status for persona {persona}")
        persona_statuses.append(str(status))
        findings = review.get("findings")
        if not isinstance(findings, list):
            errors.append(f"findings for persona {persona} must be an array")
            continue
        for finding in findings:
            if not isinstance(finding, dict) or finding.get("severity") not in SEVERITIES:
                errors.append(f"persona {persona} has an invalid finding")
                continue
            reject_unknown(finding, FINDING_KEYS, f"persona {persona} finding", errors)
            if not is_non_empty_string(finding.get("description")) or not is_non_empty_string(finding.get("resolution")):
                errors.append(f"persona {persona} finding text must be non-empty")
    if seen_personas != PERSONAS:
        errors.append("persona_reviews must cover each required persona exactly once")

    interfaces = data.get("interfaces", [])
    if not isinstance(interfaces, list):
        errors.append("interfaces must be an array")
    else:
        for item in interfaces:
            if not isinstance(item, dict) or item.get("kind") not in INTERFACE_KINDS:
                errors.append("interfaces contains an invalid item")
                continue
            reject_unknown(item, INTERFACE_KEYS, "interfaces[]", errors)
            if not is_non_empty_string(item.get("name")) or not is_non_empty_string(item.get("change")):
                errors.append("interface name and change must be non-empty")

    screenshots = data.get("screenshots", [])
    if not isinstance(screenshots, list):
        errors.append("screenshots must be an array")
    else:
        for screenshot in screenshots:
            if not isinstance(screenshot, dict):
                errors.append("screenshots contains a non-object item")
                continue
            reject_unknown(screenshot, SCREENSHOT_KEYS, "screenshots[]", errors)
            if screenshot.get("sha") != implementation_sha:
                errors.append("screenshot sha mismatch")
            if not VIEWPORT_RE.fullmatch(str(screenshot.get("viewport", ""))):
                errors.append("screenshot viewport is invalid")
            if not is_non_empty_string(screenshot.get("path")) or not is_non_empty_string(screenshot.get("route")):
                errors.append("screenshot path and route must be non-empty")

    gaps = data.get("known_gaps")
    if not isinstance(gaps, list):
        errors.append("known_gaps must be an array")
    else:
        for gap in gaps:
            if not isinstance(gap, dict) or gap.get("impact") not in IMPACTS:
                errors.append("known_gaps contains an invalid item")
                continue
            reject_unknown(gap, GAP_KEYS, "known_gaps[]", errors)
            if not is_non_empty_string(gap.get("description")) or not is_non_empty_string(gap.get("next_action")):
                errors.append("known gap text must be non-empty")

    for key in ("security_privacy_notes", "ai_grounding_notes"):
        notes = data.get(key, [])
        if not isinstance(notes, list) or not all(is_non_empty_string(note) for note in notes):
            errors.append(f"{key} must be a string array")

    environment = data.get("environment", {})
    if not isinstance(environment, dict):
        errors.append("environment must be an object")
    else:
        reject_unknown(environment, ENVIRONMENT_KEYS, "environment", errors)
        if not all(value is None or is_non_empty_string(value) for value in environment.values()):
            errors.append("environment values must be non-empty strings or null")

    overall_status = data.get("overall_status")
    if overall_status not in STATUSES:
        errors.append("overall_status is invalid")
    elif overall_status == "PASS":
        required_categories = set(REQUIRED_PASS_CATEGORIES)
        if data.get("ai_grounding_notes"):
            required_categories.add("AI_GROUNDING")
        missing_categories = sorted(required_categories - passed_required_categories)
        if missing_categories:
            errors.append(
                "overall PASS is missing required passing gate categories: "
                + ", ".join(missing_categories)
            )
        if any(status != "PASS" for status in required_check_statuses):
            errors.append("overall PASS requires every required check to PASS")
        if any(status != "PASS" for status in acceptance_statuses):
            errors.append("overall PASS requires every acceptance criterion to PASS")
        if any(status != "PASS" for status in persona_statuses):
            errors.append("overall PASS requires every persona review to PASS")

    return errors


def main(argv: list[str]) -> int:
    if len(argv) not in {2, 4} or (len(argv) == 4 and argv[1] != "--repo-root"):
        print(
            "Usage: validate_report.py [--repo-root <git-root>] <path/to/qa-report.json>",
            file=sys.stderr,
        )
        return 2
    explicit_repo_root = Path(argv[2]).resolve() if len(argv) == 4 else None
    report_path = Path(argv[-1]).resolve()
    if not report_path.is_file():
        print(f"ERROR: report not found: {report_path}", file=sys.stderr)
        return 1
    try:
        data = load_report(report_path)
        discovery_path = explicit_repo_root or report_path.parent
        repo_root = Path(git_output(discovery_path, "rev-parse", "--show-toplevel"))
        errors = validate(report_path)
        errors.extend(validate_git_binding(data, repo_root))
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: cannot read report: {error}", file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("PASS: report invariants satisfied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
