#!/usr/bin/env python3
"""Regression checks for the pinned Gitleaks installer trust boundary."""

import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "install-gitleaks.sh"


class TestInstallGitleaks(unittest.TestCase):
    def test_uses_committed_platform_hashes_instead_of_remote_checksum(self):
        source = SCRIPT.read_text(encoding="utf-8")

        self.assertNotIn("checksums.txt", source)
        self.assertEqual(source.count("curl --fail"), 1)
        for archive in ("darwin/arm64", "darwin/x64", "linux/arm64", "linux/x64"):
            self.assertIn(archive, source)


if __name__ == "__main__":
    unittest.main()
