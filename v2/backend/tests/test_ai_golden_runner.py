from pathlib import Path

import pytest

from app.ai.golden_runner import BehavioralStatus, GoldenContractRunner, GoldenSuiteError

GOLDEN_PATH = Path(__file__).parents[2] / "contracts" / "ai-golden-evals.yaml"


def test_all_33_golden_declarations_are_validated_without_claiming_behavioral_pass() -> None:
    report = GoldenContractRunner.from_yaml(GOLDEN_PATH).run()

    assert report.total == 33
    assert report.contract_validated_count == 33
    assert report.behavioral_passed_count == 0
    assert report.behavioral_failed_count == 0
    assert report.behavioral_not_run_count == 33
    assert len({result.case_id for result in report.results}) == 33
    assert all(result.contract_checks_executed >= 4 for result in report.results)
    assert all(result.behavioral_status == BehavioralStatus.NOT_RUN for result in report.results)


def test_runner_rejects_unknown_assertion_instead_of_counting_it_as_passed(
    tmp_path: Path,
) -> None:
    mutated = tmp_path / "mutated.yaml"
    text = GOLDEN_PATH.read_text()
    mutated.write_text(text.replace("response_data_is_null", "unknown_unimplemented_assertion", 1))

    with pytest.raises(GoldenSuiteError, match="unknown_unimplemented_assertion"):
        GoldenContractRunner.from_yaml(mutated).run()


def test_runner_enforces_release_gate_values(tmp_path: Path) -> None:
    mutated = tmp_path / "mutated-release-gate.yaml"
    text = GOLDEN_PATH.read_text()
    mutated.write_text(
        text.replace("cross_tenant_exposure_count: 0", "cross_tenant_exposure_count: 1")
    )

    with pytest.raises(GoldenSuiteError, match="cross_tenant_exposure_count"):
        GoldenContractRunner.from_yaml(mutated).run()


def test_runner_rejects_ai_status_outside_public_envelope(tmp_path: Path) -> None:
    mutated = tmp_path / "mutated-status.yaml"
    text = GOLDEN_PATH.read_text()
    mutated.write_text(text.replace("ai_status: ok", "ai_status: degraded", 1))

    with pytest.raises(GoldenSuiteError, match="unsupported ai_status"):
        GoldenContractRunner.from_yaml(mutated).run()
