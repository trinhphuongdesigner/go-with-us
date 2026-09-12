#!/usr/bin/env bash
set -euo pipefail

qc_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
qc_env="$qc_root/.qc.env"
qc_action="${1:-up}"

case "$qc_action" in
  up|build|down|status|logs) ;;
  *) printf 'Usage: bash v2/scripts/qc.sh {up|build|down|status|logs}\n' >&2; exit 2 ;;
esac

command -v docker >/dev/null || { printf 'Docker Desktop with Compose is required.\n' >&2; exit 1; }
docker compose version >/dev/null

if [[ ! -e "$qc_env" ]]; then
  if [[ "$qc_action" != up && "$qc_action" != build ]]; then
    printf 'No QC environment exists. Start with: bash v2/scripts/qc.sh up\n' >&2
    exit 1
  fi
  command -v openssl >/dev/null || { printf 'OpenSSL is required to generate local QC credentials.\n' >&2; exit 1; }
  # Refuse accidental credential tracking even if this script is moved to another checkout.
  git -C "$qc_root" check-ignore -q .qc.env || {
    printf 'Refusing to write credentials: v2/.qc.env must be ignored by Git.\n' >&2
    exit 1
  }
  (
    umask 077
    set -o noclobber
    {
      printf '# Local QC only. Private credentials: do not share or commit this file.\n'
      printf 'QC_API_PORT=8140\nQC_WEB_PORT=3140\nQC_DB_PORT=55440\n'
      for qc_key in QC_POSTGRES_PASSWORD QC_JWT_SECRET QC_SUPER_ADMIN_PASSWORD QC_COMPANY_ADMIN_PASSWORD QC_EMPLOYEE_PASSWORD QC_BOD_PASSWORD QC_HR_PASSWORD; do
        qc_value="$(openssl rand -hex 32)"
        printf '%s=%s\n' "$qc_key" "$qc_value"
      done
    } > "$qc_env"
  )
  printf 'Created private local QC credentials in v2/.qc.env; values were not printed.\n'
fi

if [[ ! -f "$qc_env" || -L "$qc_env" ]]; then
  printf 'Refusing QC credentials unless v2/.qc.env is a regular, non-symlink file.\n' >&2
  exit 1
fi
chmod 600 "$qc_env"

qc_compose=(docker compose --project-name careermate-v2-qc --env-file "$qc_env" --file "$qc_root/compose.qc.yaml")
case "$qc_action" in
  build)
    "${qc_compose[@]}" build backend frontend
    ;;
  up)
    "${qc_compose[@]}" build backend frontend
    "${qc_compose[@]}" up -d --wait db
    "${qc_compose[@]}" run --rm --no-deps backend alembic upgrade head
    "${qc_compose[@]}" run --rm --no-deps backend python -m scripts.seed_qc
    "${qc_compose[@]}" up -d --wait backend frontend
    qc_web_address="$("${qc_compose[@]}" port frontend 3000)"
    printf '\nQC is ready. Web address: http://localhost:%s/login\n' "${qc_web_address##*:}"
    printf 'Login emails and credential keys: v2/QC-QUICKSTART.md. Open v2/.qc.env locally for passwords.\n'
    ;;
  down)
    "${qc_compose[@]}" down
    printf 'QC containers stopped. PostgreSQL volume and v2/.qc.env were preserved.\n'
    ;;
  status)
    "${qc_compose[@]}" ps
    ;;
  logs)
    "${qc_compose[@]}" logs --tail 100 backend frontend
    ;;
esac
