from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_revision_identifiers_fit_alembic_version_column() -> None:
    backend = Path(__file__).parents[1]
    config = Config(backend / "alembic.ini")
    config.set_main_option("script_location", str(backend / "alembic"))
    revisions = list(ScriptDirectory.from_config(config).walk_revisions())

    assert revisions
    assert all(len(revision.revision) <= 32 for revision in revisions)
