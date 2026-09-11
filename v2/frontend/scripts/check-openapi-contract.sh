#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
frontend_dir="$(cd "$script_dir/.." && pwd)"
contract_path="$frontend_dir/../contracts/openapi.json"
generated_path="$frontend_dir/../contracts/generated/openapi.ts"
temporary_path="$(mktemp "${TMPDIR:-/tmp}/careermate-openapi.XXXXXX.ts")"
trap 'rm -f "$temporary_path"' EXIT

"$frontend_dir/node_modules/.bin/openapi-typescript" "$contract_path" -o "$temporary_path" >/dev/null

if ! cmp -s "$temporary_path" "$generated_path"; then
  echo "Generated TypeScript contract is stale. Run: npm run contracts:generate" >&2
  exit 1
fi

echo "Generated TypeScript contract is current."
