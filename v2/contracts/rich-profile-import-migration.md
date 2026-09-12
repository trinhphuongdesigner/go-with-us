# Rich multi-source profile import (FastAPI v2)

Source behavior: `origin/master` profile-imports analyze/refine/apply-rich. This is additive to the existing evidence-checked import/job-title flow; it does not replace or weaken that flow.

## Runtime interface

- Mount `app.rich_profile_import.routes.router` under `/api/v2`.
- Migration `0015_rich_profile_import` follows `0014_organization`.
- UI `/ho-so/nhap-da-nguon`, component `RichImportView`.
- Auth requires current `profile:self`, always owner + company scope.
- `GET /profile-rich-imports` returns latest 100 imports.
- `GET /profile-rich-imports/{id}` returns one proposal, not raw source text.
- `POST /profile-rich-imports/analyze`: multipart `pastedTexts` JSON string array, `urls` JSON string array, repeated `files`.
- `POST /profile-rich-imports/{id}/refine`: expectedVersion, instruction, edited proposal.
- `POST /profile-rich-imports/{id}/apply`: expectedVersion, clientRequestId, confirmIdentity, selected/edited updates.
- `DELETE /profile-rich-imports/{id}` removes retained sources/proposal; previously applied profile records remain.

## Feature parity and safeguards

All eight groups are reviewed independently: basicInfo, skills, projects, certifications, awards, activities, goals, roadmap. UI defaults to no selected items. User can edit each selected field, omit any item, inspect/edit roadmap tasks, and explicitly apply once.

- Basic name/jobTitle/summary are display-only comparison, matching upstream apply-rich behavior; only phone is applied from basicInfo. Existing verified job-title workflow remains separate.
- Distinct skills use the normalized catalog key. Same rating/note is skipped; changed rating is self-assessed, with version/provenance updated.
- Projects/certifications/awards use name + date duplicate checks. Activities/goals add category to duplicate identity.
- Explicit roadmap apply creates a new attempt, not replacement history, with WORK/PERSONAL preserved and final milestone linked to a goal.
- No automatic HR request, verified label or endorsement. Resource provenance is SELF; awards selfReported and skills selfAssessed are true.
- Identity mismatch is preserved through refinement and requires a separate explicit confirmation. It never silently drops the rest of a proposal.
- Raw source text is encrypted using the shared AI-connection cipher, is owner-scoped, and is never logged or returned by the read endpoints. Original upload bytes are not retained by this flow.
- Refinement uses encrypted original sources, latest actual profile snapshot and edited proposal. Apply checks the snapshot fingerprint, version and row lock before a single transaction; retry with the same request and body returns the stored receipt rather than duplicating records.

## Source limits / operator dependencies

- Up to 10 files, 10 MB/file. Real DocumentExtractor handles PDF/DOCX/XLSX/CSV/UTF-8 TXT/Markdown and OCR-supported image formats. Legacy `.xls` must be exported to `.xlsx` first; binary-to-UTF8 fallback from upstream is intentionally not copied.
- ClamAV must be configured and return CLEAN before file extraction or any AI call. Scanner absence/failure is 503 with paste/URL alternative. OCR images require configured Tesseract.
- Up to five explicitly entered HTTPS URLs. Requests resolve only public IPs, pin the connection to one validated address while verifying the original TLS hostname, validate every redirect (maximum three), reject credentials/private targets, bound response to 2 MB, and accept HTML/plain text only. No cookies or authenticated browsing. Login-only pages should be pasted/uploaded by the user.
- At least 30 and at most 60,000 extracted characters per analysis. Provider errors return real failure; no fake proposals.
- Source partial dates follow upstream: YYYY → January 1; YYYY-MM → day 1. Visible precision notes require users to check these convention dates before selecting/applying. Absent dates stay absent; invalid dates are rejected, not silently corrected.
- Source form supports removing individual files and confirmed reset of current text/URLs/files without deleting server proposals or applied profile records. Proposal groups and roadmap tasks can be reordered or removed before explicit apply; selection follows the item when reordered.

## Frozen source update 8f6a7fb

Reviewed diff from 8d5eee37. Profile-import category removals are intentionally not copied: the user explicitly requires WORK/PERSONAL. Other service changes in this domain are formatting-only. Source cleanup/reset is local draft cleanup, not removal of previously applied records.

## Build-only handoff

Module import compiled successfully. No regression, browser, real provider, OCR or malware-scanner tests were run by this worker per the user's build-only request. Parent runs integrated build/migrations and QC owns functional feedback.
