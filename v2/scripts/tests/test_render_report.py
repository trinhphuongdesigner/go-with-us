#!/usr/bin/env python3
"""Unit tests for render_report.py using stdlib unittest."""

import html
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "render_report.py"
FIXTURES = Path(__file__).resolve().parent / "fixtures"


class TestRenderReport(unittest.TestCase):
    def _run(self, report_path: Path, out_dir: Path) -> subprocess.CompletedProcess:
        # render writes to same dir as report
        return subprocess.run(
            [sys.executable, str(SCRIPT), str(report_path)],
            capture_output=True,
            text=True,
        )

    def test_html_escapes_untrusted_content(self):
        rp = FIXTURES / "escape_test.json"
        with tempfile.TemporaryDirectory() as td:
            # copy fixture to temp to avoid polluting
            import shutil
            tmp_report = Path(td) / "qa-report.json"
            shutil.copy(rp, tmp_report)
            res = subprocess.run(
                [sys.executable, str(SCRIPT), str(tmp_report)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(res.returncode, 0, res.stderr)
            html_content = (Path(td) / "report.html").read_text(encoding="utf-8")
            # must not contain raw <script> or raw <b>
            self.assertNotIn("<script>", html_content)
            self.assertNotIn("<b>bold</b>", html_content)
            # should contain escaped versions
            self.assertIn("&lt;script&gt;", html_content)
            self.assertIn("&lt;b&gt;bold&lt;/b&gt;", html_content)

    def test_determinism_same_input_same_output(self):
        rp = FIXTURES / "escape_test.json"
        with tempfile.TemporaryDirectory() as td:
            import shutil, hashlib
            tmp_report = Path(td) / "qa-report.json"
            shutil.copy(rp, tmp_report)
            res1 = subprocess.run([sys.executable, str(SCRIPT), str(tmp_report)], capture_output=True, text=True)
            h1 = hashlib.sha256((Path(td)/"report.html").read_bytes()).hexdigest()
            res2 = subprocess.run([sys.executable, str(SCRIPT), str(tmp_report)], capture_output=True, text=True)
            h2 = hashlib.sha256((Path(td)/"report.html").read_bytes()).hexdigest()
            self.assertEqual(h1, h2)
            self.assertEqual(res1.returncode, 0)
            self.assertEqual(res2.returncode, 0)

    def test_invalid_status_fails_closed_without_writing_outputs(self):
        source = json.loads((FIXTURES / "valid_report.json").read_text(encoding="utf-8"))
        source["checks"][0]["status"] = 'PASS\"><img src=x onerror=alert(1)>'
        with tempfile.TemporaryDirectory() as td:
            report = Path(td) / "qa-report.json"
            report.write_text(json.dumps(source), encoding="utf-8")
            result = self._run(report, Path(td))
            self.assertEqual(result.returncode, 1)
            self.assertFalse((Path(td) / "report.html").exists())
            self.assertFalse((Path(td) / "README.md").exists())


if __name__ == "__main__":
    unittest.main()
