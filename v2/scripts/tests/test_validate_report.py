#!/usr/bin/env python3
"""Unit tests for validate_report.py using stdlib unittest."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "validate_report.py"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
REPO_ROOT = Path(__file__).resolve().parents[3]


class TestValidateReport(unittest.TestCase):
    def _git(self, repo_root: Path, *arguments: str) -> str:
        return subprocess.run(
            ["git", "-C", str(repo_root), *arguments],
            capture_output=True,
            check=True,
            text=True,
        ).stdout.strip()

    def _run(self, report_path: Path, repo_root: Path = REPO_ROOT) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--repo-root", str(repo_root), str(report_path)],
            capture_output=True,
            text=True,
        )

    def _bound_report(self, source: dict, repo_root: Path, revision: str = "HEAD") -> dict:
        implementation_sha = self._git(repo_root, "rev-parse", revision)
        tree_sha = self._git(repo_root, "rev-parse", f"{implementation_sha}^{{tree}}")
        source["implementation_sha"] = implementation_sha
        source["verified_tree_sha"] = tree_sha
        for check in source.get("checks", []):
            check["exact_sha"] = implementation_sha
        for screenshot in source.get("screenshots", []):
            screenshot["sha"] = implementation_sha
        return source

    def _write_report(self, directory: Path, source: dict) -> Path:
        report = directory / "qa-report.json"
        report.write_text(json.dumps(source), encoding="utf-8")
        return report

    def _valid_source(self, repo_root: Path = REPO_ROOT, revision: str = "HEAD") -> dict:
        source = json.loads((FIXTURES / "valid_report.json").read_text(encoding="utf-8"))
        return self._bound_report(source, repo_root, revision)

    def test_valid_report_passes(self):
        with tempfile.TemporaryDirectory() as td:
            rp = self._write_report(Path(td), self._valid_source())
            res = self._run(rp)
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertIn("PASS", res.stdout)

    def test_malformed_missing_field_fails(self):
        rp = FIXTURES / "malformed_missing_field.json"
        res = self._run(rp)
        self.assertEqual(res.returncode, 1)
        self.assertIn("ERROR", res.stderr)
        # should mention missing required field like checks or persona_reviews min
        self.assertTrue("checks" in res.stderr.lower() or "persona" in res.stderr.lower())

    def test_sha_mismatch_fails(self):
        rp = FIXTURES / "sha_mismatch.json"
        res = self._run(rp)
        self.assertEqual(res.returncode, 1)
        self.assertIn("exact_sha mismatch", res.stderr)

    def test_cross_reference_fails(self):
        rp = FIXTURES / "cross_ref_bad.json"
        res = self._run(rp)
        self.assertEqual(res.returncode, 1)
        self.assertIn("unknown check id", res.stderr.lower())

    def test_overall_pass_requires_complete_gate_inventory(self):
        source = self._valid_source()
        source["checks"] = [check for check in source["checks"] if check["category"] != "SECURITY"]
        with tempfile.TemporaryDirectory() as td:
            report = self._write_report(Path(td), source)
            result = self._run(report)
        self.assertEqual(result.returncode, 1)
        self.assertIn("missing required passing gate categories: SECURITY", result.stderr)

    def test_unknown_nested_field_fails_closed(self):
        source = self._valid_source()
        source["checks"][0]["unreviewed"] = True
        with tempfile.TemporaryDirectory() as td:
            report = self._write_report(Path(td), source)
            result = self._run(report)
        self.assertEqual(result.returncode, 1)
        self.assertIn("unknown field checks[0].unreviewed", result.stderr)

    def test_overall_pass_requires_verified_tree(self):
        source = self._valid_source()
        source.pop("verified_tree_sha")
        with tempfile.TemporaryDirectory() as td:
            result = self._run(self._write_report(Path(td), source))
        self.assertEqual(result.returncode, 1)
        self.assertIn("overall PASS requires verified_tree_sha", result.stderr)

    def test_nonexistent_implementation_commit_fails(self):
        source = self._valid_source()
        nonexistent = "f" * 40
        source["implementation_sha"] = nonexistent
        for check in source["checks"]:
            check["exact_sha"] = nonexistent
        with tempfile.TemporaryDirectory() as td:
            result = self._run(self._write_report(Path(td), source))
        self.assertEqual(result.returncode, 1)
        self.assertIn("implementation_sha must identify an existing Git commit", result.stderr)

    def test_verified_tree_must_match_implementation_tree(self):
        source = self._valid_source()
        source["verified_tree_sha"] = source["implementation_sha"]
        with tempfile.TemporaryDirectory() as td:
            result = self._run(self._write_report(Path(td), source))
        self.assertEqual(result.returncode, 1)
        self.assertIn("verified_tree_sha must match the implementation commit tree", result.stderr)

    def test_pass_criterion_may_not_cite_a_failed_check(self):
        source = self._valid_source()
        source["checks"].append(
            {
                "id": "CHK-OPTIONAL-FAIL",
                "category": "PUSH",
                "required": False,
                "status": "FAIL",
                "command": "false",
                "cwd": ".",
                "started_at": "2025-09-12T01:59:00Z",
                "finished_at": "2025-09-12T01:59:01Z",
                "exit_code": 1,
                "exact_sha": source["implementation_sha"],
                "summary": "failed",
                "artifact_paths": [],
            }
        )
        source["acceptance_criteria"][0]["evidence_check_ids"] = ["CHK-OPTIONAL-FAIL"]
        with tempfile.TemporaryDirectory() as td:
            result = self._run(self._write_report(Path(td), source))
        self.assertEqual(result.returncode, 1)
        self.assertIn("may reference only PASS checks", result.stderr)

    def test_historical_implementation_commit_remains_valid_on_descendant(self):
        with tempfile.TemporaryDirectory() as td:
            repo_root = Path(td)
            self._git(repo_root, "init", "-b", "main")
            (repo_root / "implementation.txt").write_text("implementation", encoding="utf-8")
            self._git(repo_root, "add", "implementation.txt")
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "implementation",
            )
            implementation_sha = self._git(repo_root, "rev-parse", "HEAD")
            report_doc = repo_root / "v2" / "reports" / "test" / "report-doc.txt"
            report_doc.parent.mkdir(parents=True)
            report_doc.write_text("later report commit", encoding="utf-8")
            self._git(repo_root, "add", str(report_doc.relative_to(repo_root)))
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "docs",
            )

            source = self._valid_source(repo_root, implementation_sha)
            report = self._write_report(repo_root, source)
            result = self._run(report, repo_root)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_descendant_source_change_preserves_historical_report(self):
        with tempfile.TemporaryDirectory() as td:
            repo_root = Path(td)
            self._git(repo_root, "init", "-b", "main")
            source_file = repo_root / "v2" / "backend" / "app.py"
            source_file.parent.mkdir(parents=True)
            source_file.write_text("version = 1\n", encoding="utf-8")
            self._git(repo_root, "add", str(source_file.relative_to(repo_root)))
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "implementation",
            )
            implementation_sha = self._git(repo_root, "rev-parse", "HEAD")
            source_file.write_text("version = 2\n", encoding="utf-8")
            self._git(repo_root, "add", str(source_file.relative_to(repo_root)))
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "unverified source change",
            )

            source = self._valid_source(repo_root, implementation_sha)
            result = self._run(self._write_report(repo_root, source), repo_root)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_historical_report_still_rejects_wrong_implementation_tree(self):
        with tempfile.TemporaryDirectory() as td:
            repo_root = Path(td)
            self._git(repo_root, "init", "-b", "main")
            source_file = repo_root / "v2" / "backend" / "app.py"
            source_file.parent.mkdir(parents=True)
            source_file.write_text("version = 1\n", encoding="utf-8")
            self._git(repo_root, "add", str(source_file.relative_to(repo_root)))
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "implementation",
            )
            implementation_sha = self._git(repo_root, "rev-parse", "HEAD")
            source_file.write_text("version = 2\n", encoding="utf-8")
            self._git(repo_root, "add", str(source_file.relative_to(repo_root)))
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "next feature",
            )

            source = self._valid_source(repo_root, implementation_sha)
            source["verified_tree_sha"] = self._git(repo_root, "rev-parse", "HEAD^{tree}")
            result = self._run(self._write_report(repo_root, source), repo_root)

        self.assertEqual(result.returncode, 1)
        self.assertIn(
            "verified_tree_sha must match the implementation commit tree",
            result.stderr,
        )

    def test_non_ancestor_implementation_commit_fails(self):
        with tempfile.TemporaryDirectory() as td:
            repo_root = Path(td)
            self._git(repo_root, "init", "-b", "main")
            (repo_root / "base.txt").write_text("base", encoding="utf-8")
            self._git(repo_root, "add", "base.txt")
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "base",
            )
            self._git(repo_root, "checkout", "-b", "side")
            (repo_root / "side.txt").write_text("side", encoding="utf-8")
            self._git(repo_root, "add", "side.txt")
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "side",
            )
            side_sha = self._git(repo_root, "rev-parse", "HEAD")
            self._git(repo_root, "checkout", "main")
            (repo_root / "main.txt").write_text("main", encoding="utf-8")
            self._git(repo_root, "add", "main.txt")
            self._git(
                repo_root,
                "-c",
                "user.name=CareerMate Test",
                "-c",
                "user.email=test@careermate.invalid",
                "commit",
                "-m",
                "main",
            )

            source = self._valid_source(repo_root, side_sha)
            result = self._run(self._write_report(repo_root, source), repo_root)

        self.assertEqual(result.returncode, 1)
        self.assertIn("implementation_sha must be an ancestor", result.stderr)


if __name__ == "__main__":
    unittest.main()
