from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.main import app


def rendered_schema() -> str:
    return json.dumps(app.openapi(), indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output_path = Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"
    expected = rendered_schema()

    if args.check:
        if not output_path.exists() or output_path.read_text() != expected:
            print("OpenAPI snapshot is stale. Run scripts/export_openapi.py")
            return 1
        print("OpenAPI snapshot is current.")
        return 0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(expected)
    print(f"OpenAPI exported to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
