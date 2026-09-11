import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize(
    "unsafe_url",
    [
        "postgresql+asyncpg://ignored@db.example.com/careermate_v2_test",
        "postgresql+asyncpg://ignored@127.0.0.1/careermate_v2",
        "postgresql+asyncpg://ignored@localhost/careermate_v2_test?host=db.example.com",
        "postgresql+asyncpg://ignored@localhost/careermate_v2_test?database=careermate_v2",
        "sqlite+aiosqlite:///tmp/careermate.db",
        "mysql+aiomysql://ignored@127.0.0.1/careermate_v2_test",
    ],
)
def test_direct_pytest_import_rejects_unsafe_database(unsafe_url: str) -> None:
    environment = os.environ.copy()
    environment["CAREERMATE_TEST_DATABASE_URL"] = unsafe_url

    result = subprocess.run(
        [sys.executable, "-c", "import runpy; runpy.run_path('tests/conftest.py')"],
        cwd=Path(__file__).parents[1],
        env=environment,
        capture_output=True,
        check=False,
        text=True,
        timeout=15,
    )

    assert result.returncode != 0
    assert "Refusing destructive tests" in result.stderr
