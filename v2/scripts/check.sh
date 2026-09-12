#!/usr/bin/env bash
# CareerMate v2 fail-closed local/CI quality gate. Database writes are restricted
# to the dedicated test and migration-check databases.

set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
v2_root="$workspace_root/v2"
backend_dir="$v2_root/backend"
frontend_dir="$v2_root/frontend"
scripts_dir="$v2_root/scripts"
reports_dir="$v2_root/reports"
gitleaks_bin="${GITLEAKS_BIN:-$v2_root/.tools/gitleaks}"
failures=0
exact_sha="$(git -C "$workspace_root" rev-parse HEAD)"

# The backend test fixture recreates its schema. Pin every local/CI gate to the
# dedicated v2 test database and fail before pytest if a caller points elsewhere.
export CAREERMATE_ENVIRONMENT="test"
export CAREERMATE_TEST_DATABASE_URL="${CAREERMATE_TEST_DATABASE_URL:-postgresql+asyncpg://careermate:careermate@127.0.0.1:55432/careermate_v2_test}"
if [[ "$CAREERMATE_TEST_DATABASE_URL" != postgresql+asyncpg://*/careermate_v2_test ]]; then
  echo "FAIL: CAREERMATE_TEST_DATABASE_URL phải trỏ chính xác tới PostgreSQL careermate_v2_test." >&2
  exit 1
fi
export CAREERMATE_DATABASE_URL="$CAREERMATE_TEST_DATABASE_URL"
export CAREERMATE_JWT_SECRET="${CAREERMATE_JWT_SECRET:-quality-gate-only-secret-that-is-at-least-32-characters}"
export CAREERMATE_MIGRATION_DATABASE_URL="${CAREERMATE_MIGRATION_DATABASE_URL:-postgresql+asyncpg://careermate:careermate@127.0.0.1:55432/careermate_v2_migration_check}"
if [[ "$CAREERMATE_MIGRATION_DATABASE_URL" != postgresql+asyncpg://*/careermate_v2_migration_check && "$CAREERMATE_MIGRATION_DATABASE_URL" != postgresql+asyncpg://*/careermate_v2_test ]]; then
  echo "FAIL: CAREERMATE_MIGRATION_DATABASE_URL phải trỏ tới database migration-check hoặc test của v2." >&2
  exit 1
fi

run_gate() {
  local label="$1"
  shift
  echo ">>> $label"
  if "$@"; then
    echo "PASS: $label"
  else
    echo "FAIL: $label" >&2
    failures=$((failures + 1))
  fi
}

echo "=== CareerMate v2 quality gates ==="

if [[ -n "$(git -C "$workspace_root" status --porcelain=v1 -- v2/backend v2/frontend v2/contracts)" ]]; then
  echo "FAIL: Backend, frontend hoặc contracts chưa sạch; không thể gắn test với SHA $exact_sha." >&2
  failures=$((failures + 1))
else
  echo "PASS: Source tree sạch tại SHA $exact_sha"
fi

if [[ -x "$backend_dir/.venv/bin/python" ]]; then
  backend_python="$backend_dir/.venv/bin/python"
elif command -v uv >/dev/null 2>&1; then
  backend_python="uv"
else
  echo "FAIL: Không tìm thấy backend/.venv/bin/python hoặc uv." >&2
  exit 1
fi

pushd "$backend_dir" >/dev/null
if [[ "$backend_python" == "uv" ]]; then
  run_gate "Backend format" uv run python -m ruff format --check .
  run_gate "Backend lint" uv run python -m ruff check .
  run_gate "Backend typecheck" uv run python -m mypy app scripts
  run_gate "Backend unit/integration" uv run python -m pytest -q
  run_gate "Backend migration upgrade" env CAREERMATE_DATABASE_URL="$CAREERMATE_MIGRATION_DATABASE_URL" uv run alembic upgrade head
  run_gate "Backend migration drift" env CAREERMATE_DATABASE_URL="$CAREERMATE_MIGRATION_DATABASE_URL" uv run alembic check
  run_gate "Backend security static analysis" uv run python -m bandit -r app -x tests -ll
  run_gate "Backend dependency audit" uv run python -m pip_audit --strict
  run_gate "OpenAPI snapshot" env \
    CAREERMATE_DATABASE_URL="sqlite+aiosqlite:///./openapi-check.db" \
    CAREERMATE_JWT_SECRET="contract-check-only-secret-32-characters" \
    uv run python -m scripts.export_openapi --check
else
  run_gate "Backend format" "$backend_python" -m ruff format --check .
  run_gate "Backend lint" "$backend_python" -m ruff check .
  run_gate "Backend typecheck" "$backend_python" -m mypy app scripts
  run_gate "Backend unit/integration" "$backend_python" -m pytest -q
  run_gate "Backend migration upgrade" env CAREERMATE_DATABASE_URL="$CAREERMATE_MIGRATION_DATABASE_URL" "$backend_python" -m alembic upgrade head
  run_gate "Backend migration drift" env CAREERMATE_DATABASE_URL="$CAREERMATE_MIGRATION_DATABASE_URL" "$backend_python" -m alembic check
  run_gate "Backend security static analysis" "$backend_python" -m bandit -r app -x tests -ll
  run_gate "Backend dependency audit" "$backend_python" -m pip_audit --strict
  run_gate "OpenAPI snapshot" env \
    CAREERMATE_DATABASE_URL="sqlite+aiosqlite:///./openapi-check.db" \
    CAREERMATE_JWT_SECRET="contract-check-only-secret-32-characters" \
    "$backend_python" -m scripts.export_openapi --check
fi
popd >/dev/null

pushd "$frontend_dir" >/dev/null
run_gate "Generated OpenAPI client" npm run contracts:check
run_gate "Frontend lint" npm run lint
run_gate "Frontend typecheck" npm run typecheck
run_gate "Frontend unit tests" npm test
run_gate "Frontend production build" env NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_BUILD_SHA="$exact_sha" npm run build
run_gate "Frontend production dependency audit" npm audit --omit=dev --audit-level=high
run_gate "Frontend Playwright and accessibility" env CAREERMATE_EXPECTED_SHA="$exact_sha" CAREERMATE_E2E_USE_BUILD=true npm run test:e2e
popd >/dev/null

if [[ -x "$gitleaks_bin" ]]; then
  gitleaks_base_ref="${CAREERMATE_GITLEAKS_BASE_REF:-origin/master}"
  if git -C "$workspace_root" rev-parse --verify --quiet "$gitleaks_base_ref" >/dev/null; then
    gitleaks_base="$(git -C "$workspace_root" merge-base "$gitleaks_base_ref" "$exact_sha")"
    run_gate "Secret scan committed diff" "$gitleaks_bin" git "$workspace_root" \
      --log-opts "$gitleaks_base..$exact_sha" --redact --exit-code 1
  else
    echo "FAIL: Không tìm thấy base ref $gitleaks_base_ref cho secret scan." >&2
    failures=$((failures + 1))
  fi
else
  echo "FAIL: Không tìm thấy Gitleaks tại $gitleaks_bin." >&2
  echo "Chạy bash v2/scripts/install-gitleaks.sh trước quality gate." >&2
  failures=$((failures + 1))
fi

pushd "$scripts_dir" >/dev/null
run_gate "Report tooling tests" python3 -m unittest discover -s tests -p "test_*.py" -v
run_gate "Report tooling syntax" python3 -m py_compile \
  validate_report.py render_report.py tests/test_validate_report.py tests/test_render_report.py
popd >/dev/null

validated_reports=0
for report_path in "$reports_dir"/*/qa-report.json; do
  [[ -f "$report_path" ]] || continue
  validated_reports=$((validated_reports + 1))
  run_gate "Report $(basename "$(dirname "$report_path")")" \
    python3 "$scripts_dir/validate_report.py" --repo-root "$workspace_root" "$report_path"
done

if [[ $validated_reports -eq 0 ]]; then
  echo "FAIL: Không có qa-report.json; quality gate không được PASS nếu thiếu báo cáo." >&2
  failures=$((failures + 1))
fi

if [[ $failures -gt 0 ]]; then
  echo "=== FAIL: $failures quality gate(s) ===" >&2
  exit 1
fi

echo "=== PASS: tất cả quality gates đã chạy đều đạt ==="
