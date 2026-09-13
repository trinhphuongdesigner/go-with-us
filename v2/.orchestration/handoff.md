# Handoff

Đọc theo thứ tự:

1. `goal.md`
2. `tasks.json`
3. `progress.md`
4. `quality-gates.json`
5. `../contracts/wave1-feature-contract.md`
6. `../contracts/ai-reliability-contract.md`
7. `../contracts/ai-golden-evals.yaml`
8. `../reports/quality-gates.md`
9. `../reports/03-consolidation-remediation/qa-report.json`

## Tiếp tục an toàn

- Xác minh `git branch --show-current` là `codex/v2-qa-consolidation` và worktree là `.claude/worktrees/v2-qa`.
- Chạy `git status --short`; chỉ thao tác dưới `v2/`.
- Đọc kết quả Pi/subagent, nhưng chạy lại lệnh kiểm thử trước khi ghi PASS.
- Không đưa giá trị env hoặc credential vào transcript/report.
- User đã cho phép tiếp tục remediation. Playwright/browser test vẫn tạm dừng theo chỉ dẫn gần nhất.

## Trạng thái hiện tại

- Source candidate hợp nhất đã khóa tại implementation SHA `f5d7fb093f0cd7f577131111222bcd2d8a43459c`; report/handoff đã push tại remote head `0ef9f94575592b37d20d8226c3a46dfbb22938bf`.
- Static review gốc ở `../docs/consolidation-static-review-2026-09-12.vi.md` ghi 1 P0, 31 P1, 5 P2. Remediation review mới nhất đã APPROVE và không còn P0/P1 có thể hành động trên working tree hiện tại; xem `../docs/consolidation-remediation-2026-09-13.vi.md`.
- Backend/frontend/contracts sạch tại implementation SHA trên; các PASS lịch sử phía dưới vẫn chỉ chứng minh từng slice cũ.
- Tester có thể kiểm tra thủ công trên branch đã push. Không chạy Playwright cho tới khi user mở lại browser gate.

- Baseline consolidation đã khóa tại `f5d7fb0` (f5d7fb093f0cd7f577131111222bcd2d8a43459c): SQLite 655 passed/18 skipped; PostgreSQL 17 sạch 673 passed; Alembic `0001` → `0018` và drift PASS; frontend 148 Vitest, ESLint, TypeScript và production build PASS; Ruff/mypy/audit PASS.
- Consolidation report chuẩn: `../reports/03-consolidation-remediation/qa-report.json` (overall `BLOCKED` vì browser/persona NOT_RUN, không phải vì lỗi P0/P1).
- Database test cũ ở cổng 55432 có Alembic stamp `0004` nhưng schema từng được metadata bổ sung, nên không dùng làm evidence. Không xóa/truncate; verification sạch dùng PostgreSQL cô lập ở cổng 55441.

- Wave 0 PASS tại SHA `01e1e87838d9cd4473a0e661b6dd75291b5119e6`; report chuẩn ở `../reports/00-foundation/qa-report.json`.
- Toàn dự án vẫn IN_PROGRESS; không diễn giải Wave 0 PASS thành full rebuild hoàn tất.
- Slice import của Wave 1 PASS tại SHA `de246d8c74ec8425cec0172613012fc600811719`; report chuẩn ở `../reports/01-employee-360-import/qa-report.json`.
- Slice core profile/roster PASS tại SHA `ca230bceb3b2d9be473fa8f842b23ecd51379115`; report chuẩn ở `../reports/02-core-profile-roster/qa-report.json`.
- Wave 1 vẫn IN_PROGRESS vì CRUD resource aggregate và unified timeline chưa hoàn tất.
- Bước tiếp theo: tester chạy manual flow trên branch này và ghi feedback theo route/role. Browser automation/Playwright chờ user mở lại.
- Mọi endpoint v2 dùng `/api/v2`; inventory v1 chỉ là evidence, không phải executable contract.
- File intake phải kiểm tra MIME/size/malware/hash cho PDF, DOCX, ảnh, text, CSV và XLSX; parse không tự persist; selective apply dùng transaction, version, idempotency và rollback.

## Cập nhật 2026-09-13 14:00 ICT

- Gitleaks exact-SHA đã chạy tại `f5d7fb093f0cd7f577131111222bcd2d8a43459c`: 5 finding, toàn bộ xác nhận false positive. Gap này trong `known_gaps` đã đóng; chi tiết ở `../.orchestration/progress.md` và `qa-report.json`.
- Gap còn mở duy nhất là Playwright/axe/visual/persona/performance — vẫn NOT_RUN theo yêu cầu tạm dừng của user; `overall_status` vẫn `BLOCKED`.

## Cập nhật 2026-09-13 14:39 ICT

- Task riêng lẻ `W1-EXPERIENCE-TIMELINE` PASS tại SHA `690061de5b263d5491f1b2017fea515165146d0d`: rà soát Experience CRUD + mốc Experience trong career timeline hợp nhất (authz, optimistic CAS 409, validate, activity log, deterministic tie-break ordering). Logic sản phẩm đã đúng, chỉ bổ sung test còn thiếu — không rewrite. Report chuẩn ở `../reports/04-w1-experience-timeline/qa-report.json`.
- Bằng chứng mới: backend 656 passed/18 skipped (tăng 1 so với 655 baseline); frontend 152 passed/21 file (tăng từ 148/20 baseline); lint/typecheck/build sạch; 2 lượt review độc lập không có finding cần sửa.
- Phạm vi task này KHÔNG đụng project/certification/award/goal/assessment/passport/staffing — các khu vực đó vẫn giữ nguyên trạng thái như report 03.
- Playwright/browser/persona vẫn NOT_RUN theo chỉ dẫn tạm dừng của user.

## Cập nhật 2026-09-13 16:20 ICT

- Task riêng lẻ `W1-PROJECT-TIMELINE` PASS tại SHA `f845494ef9939a6bf574fc74fb379003b3d68abf`: rà soát Project CRUD + mốc Project trong career timeline hợp nhất (authz, optimistic CAS 409, validate, provenance, activity-log rollback, deterministic tie-break ordering). Reviewer độc lập review base `65507c6`, ra REQUEST_CHANGES với 2 finding thực: P1 stale draft có thể ghi đè thay đổi mới trên server sau reload (ProfileResourceEditForm không đóng/không remount sau reloadProfile()), P2 test rollback chỉ phủ update thiếu delete. Cả 2 đã sửa (remount key theo profileVersion + đóng editor khi reload; parametrize test rollback [update, delete]) và reviewer re-review xác nhận CLOSED. Backend 661 passed/18 skipped, frontend 157 passed/22 file. Report chuẩn ở `../reports/05-w1-project-timeline/qa-report.json`.
- Bằng chứng mới: backend 661 passed/18 skipped (tăng 5 so với 656 baseline); frontend 157 passed/22 file (tăng từ 152/21 baseline); ruff/mypy/eslint/tsc/next-build sạch.
- Review độc lập: reviewer bên ngoài phiên này review base `65507c6`, ra REQUEST_CHANGES với 2 finding (P1, P2 — xem bullet trên); sau khi sửa tại `f845494ef9939a6bf574fc74fb379003b3d68abf`, reviewer re-review đúng nội dung fix và xác nhận CLOSED, không còn P0/P1/P2, `git diff --check` sạch — verdict PASS.
- Phạm vi task này KHÔNG đụng experience/certification/award/goal/assessment/passport/staffing — các khu vực đó vẫn giữ nguyên trạng thái như report 03/04.
- Playwright/browser/persona vẫn NOT_RUN theo chỉ dẫn tạm dừng của user.

## Cập nhật 2026-09-14 00:00 ICT

- Task riêng lẻ `W1-CERTIFICATION-TIMELINE` ở trạng thái **`P2_FIXED_PENDING_REREVIEW`** (CHƯA PASS): rà soát Certification CRUD + mốc Certification trong career timeline hợp nhất (authz, optimistic CAS 409, validate type/field bắt buộc/quan hệ ngày, provenance, activity-log rollback update+delete, deterministic tie-break ordering + field mapping đầy đủ). Logic sản phẩm đã đúng, chỉ bổ sung test còn thiếu — không sửa code sản phẩm.
- Reviewer độc lập review candidate ban đầu, ra **REQUEST_CHANGES** với đúng 2 finding, cả hai P2 (không P0/P1): P2-1 test frontend create/edit chỉ phủ giá trị mặc định, không đổi field Certification-specific khác; P2-2 test timeline thiếu assert field mapping đầy đủ mỗi item (kind/title/subtitle/startDate/endDate/sourceType). Cả 2 đã sửa trong working tree của phiên này.
- Bằng chứng sau khi sửa: backend 666 passed/18 skipped (không regression); frontend 162 passed/23 file; ruff/mypy/lint/typecheck/next-build đều sạch; `git diff --check` sạch. Report chuẩn ở `../reports/06-w1-certification-timeline/qa-report.json`.
- Lưu ý: các con số 655/148, 656/152, 661/157 xuất hiện ở các mục cập nhật phía trên là baseline lịch sử của consolidation/W1-EXPERIENCE-TIMELINE/W1-PROJECT-TIMELINE (task khác, SHA khác), không phải số của W1-CERTIFICATION-TIMELINE. Số hiện tại (working tree, chưa commit) của task này là backend 666 passed/18 skipped, frontend 162 passed/23 file.
- **Task này CHƯA gửi lại reviewer độc lập re-review** — vì vậy KHÔNG được diễn giải thành PASS. Bước tiếp theo bắt buộc: gửi lại cho reviewer độc lập xác nhận CLOSED trước khi `git add`/commit/push bất kỳ thay đổi nào của task này.
- Thay đổi vẫn nằm trong working tree, chưa staged/committed/pushed. Phạm vi task này KHÔNG đụng experience/project/award/goal/assessment/passport/staffing — các khu vực đó vẫn giữ nguyên trạng thái như report 03/04/05.
- Playwright/browser/persona vẫn NOT_RUN theo chỉ dẫn tạm dừng của user.

## Cập nhật 2026-09-14 01:00 ICT — W1-CERTIFICATION-TIMELINE: FINAL APPROVE, PASS

- Task `W1-CERTIFICATION-TIMELINE` chuyển từ `P2_FIXED_PENDING_REREVIEW` sang **`PASS`**. Sau khi
  2 finding P2 được sửa (xem mục 2026-09-14 00:00 ICT phía trên), docs (evidence trong
  `qa-report.json`/`README.md`) trải qua thêm 2 vòng re-review độc lập chỉ để khớp evidence chính
  xác với hành vi test thật (không có finding mới về code/test trong 2 vòng này). Verdict cuối
  cùng của reviewer độc lập: **FINAL APPROVE, 0 P0/P1/P2**.
- Test code đã commit tại `d258d8759678b0eaaa0b5f4be437989040bdf306` (`test(v2/profile): cover certification CRUD and timeline`),
  đúng 2 file: `test_competency_profile_api.py` và `profile-view.certification.test.tsx`. Đây là
  commit test-only, tách riêng khỏi commit docs theo yêu cầu.
- Test counts không đổi so với lúc chưa commit: backend 666 passed/18 skipped, frontend 162
  passed/23 file. Playwright/browser/persona vẫn **NOT_RUN** — không claim đã chạy browser.
- Report chuẩn cập nhật ở `../reports/06-w1-certification-timeline/qa-report.json` (README.md
  đồng bộ): `overall_status: "PASS"`, `implementation_sha`/`verified_tree_sha` = `d258d8759678b0eaaa0b5f4be437989040bdf306`.
- Phạm vi vẫn KHÔNG đụng experience/project/award/goal/assessment/passport/staffing — các khu vực
  đó giữ nguyên trạng thái như report 03/04/05.
