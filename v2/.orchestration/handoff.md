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

## Cập nhật 2026-09-14 09:44 ICT — W1-AWARD-TIMELINE: PENDING_REVIEW

- Candidate Award nằm trên base HEAD `2fc53c80156e7697d0de715a44d3fc7b40772ceb`. Các thay
  đổi của slice W1-AWARD chỉ nằm trong `v2/` và chưa stage/commit/push; những file v1 ở root đã
  dirty từ trước vẫn ngoài phạm vi và chưa stage. Các file liên quan: backend `test_competency_profile_api.py`, frontend
  `profile-view.award.test.tsx`, report `../reports/07-w1-award-timeline/` và ledger.
- Focused verification hiện tại: backend 10 Award tests PASS, frontend 5/5 PASS, Ruff và diff
  check PASS. Không có code sản phẩm thay đổi vì focused tests chưa phát hiện regression.
- Trước khi chuyển PASS: reviewer độc lập phải review toàn bộ diff, mọi finding phải được xử lý,
  sau đó chạy full non-browser gates trên đúng candidate. Playwright/browser/persona vẫn NOT_RUN.
- Pi Desktop MCP đã tạo frontend test nhưng provider trả 403 ở lượt tiếp theo; không thay provider,
  không đọc hoặc đổi credential. Backend/test report được tiếp tục an toàn trong worktree hiện tại.

## Cập nhật 2026-09-14 10:00 ICT — W1-AWARD-TIMELINE: FINAL APPROVE, PASS

- Implementation/test commit: `4c994e02192e104ccf1aeffddb740237e81dfa39`. Reviewer độc lập
  final APPROVE, 0 P0/P1/P2; cả P2-1, P2-2 và P2-3 đã CLOSED.
- Exact-commit gates: backend 673 passed/18 skipped trong 89.29s; Ruff/mypy sạch; frontend 167
  tests/24 files; ESLint/tsc/Next build 17 pages/routes đều PASS.
- Report chuẩn: `../reports/07-w1-award-timeline/qa-report.json`; README đồng bộ. Năm file docs/
  ledger được lưu bằng commit tài liệu riêng ngay sau implementation; report ghim SHA đã chạy test.
- Playwright/browser/persona vẫn NOT_RUN. Chỉ thay đổi của slice nằm trong `v2/`; các file v1
  dirty từ trước ở root vẫn ngoài phạm vi và không được stage.

## Cập nhật 2026-09-14 10:25 ICT — W1-SKILL-PROFILE: PENDING_REVIEW

- Active assignment: `W1-SKILL-PROFILE`, candidate chưa commit trên base/current HEAD
  `abc89cf9e1be012598a7068db30b2d6b1187b38d`. Không stage/commit/push.
- Reviewer vòng đầu có 4 P2; cả 4 đang ở `FIXED_PENDING_REREVIEW`. Coverage SUPER_ADMIN nay
  không rỗng: platform admin ghi skill association vào foreign tenant và test xác nhận scope,
  provenance cùng actor. SQLite sequential stale replace xác nhận 409 và
  `currentProfileVersion` mà không cần PostgreSQL.
- Catalog POST persist ngay vào danh mục dùng chung. Chỉ add/remove association, rating và note
  trong SkillsEditor còn ở draft cho tới **Lưu toàn bộ kỹ năng**.
- Focused evidence: backend 9 passed/6 skipped/34 deselected; frontend 6/6; Ruff/ESLint/tsc,
  JSON và `git diff --check` PASS. PostgreSQL concurrency/snapshot tests vẫn skip trong focused
  SQLite; full suites chờ sau re-review.
- Report nháp: `../reports/08-w1-skill-profile/qa-report.json`. Playwright/browser/persona vẫn
  `NOT_RUN`. Các file v1 dirty từ trước ngoài phạm vi và chưa stage.

## Cập nhật 2026-09-14 10:35 ICT — W1-SKILL-PROFILE: FINAL APPROVE, PASS

- Implementation/test commit: `ac4b1a88b5f18d82ea21e60e4d9cc66d101bed5b`. Reviewer độc lập
  final APPROVE, 0 P0/P1/P2; bốn finding P2 đều CLOSED.
- Exact-commit gates: từ `v2/backend`, `CAREERMATE_DEMO_LOGIN_ENABLED=false .venv/bin/pytest -q`
  đạt 678 passed/18 skipped trong 64.48s, `.venv/bin/ruff check .` PASS và `.venv/bin/mypy app`
  PASS trên 90 source files. Từ `v2/frontend`, `npm test` đạt 25 files/173 tests; `npm run lint`,
  `npm run typecheck`, `npm run build` đều PASS; static generation 17/17.
- Report chuẩn: `../reports/08-w1-skill-profile/qa-report.json`; README đồng bộ. Report và ledger
  thuộc commit tài liệu riêng ngay sau implementation/test commit; coordination state phản ánh
  trạng thái sạch sau docs commit (`documentation_commit_pending=false`).
- Playwright/browser/persona vẫn `NOT_RUN`. Khi manual tester kiểm tra lại SkillsEditor, cần nhớ
  catalog POST persist ngay; chỉ employee-skill association/rating/note là draft trước Save.
- Các file v1 dirty từ trước ở root vẫn ngoài phạm vi và không được stage.

## Cập nhật 2026-09-14 10:46 ICT — W2-ROADMAP-EDITOR-SNAPSHOT: PENDING_REVIEW

- Active assignment: `W2-ROADMAP-EDITOR-SNAPSHOT`, base/current HEAD
  `12866da103e570c79978dd2c69f6103a52069492`; chưa stage/commit/push.
- Base đã chứa snapshot fix từ `f5d7fb0`; candidate bổ sung test 409 còn thiếu và tăng assert
  cho delete race. Focused Vitest 3/3, ESLint và TypeScript PASS.
- RED đã xác nhận trên pre-fix SHA `c1148d6`: đúng hai regression test gốc đều fail (delete
  dùng B v7 thay A v3; edit dùng cache v4 thay snapshot v3). Worktree tạm đã xóa.
- P2 duy nhất đã sửa: delete test dùng deferred response và chờ confirmation UI biến mất sau
  resolve trước khi assert selection B. Trạng thái `FIXED_PENDING_REREVIEW`; chưa chuyển PASS.
- Backend contract chỉ audit tĩnh: tenant/owner scope, row lock và version check diễn ra trước
  rebuild/delete. Không có backend file thay đổi trong slice.
- Report nháp: `../reports/09-w2-roadmap-editor-snapshot/qa-report.json`. Bắt buộc review độc lập
  và full non-browser gates trước khi chuyển PASS hoặc làm git operation.
- W1 đã chuyển PASS dựa trên bảy completed slice W1; W2 chuyển IN_PROGRESS. Browser/Playwright/
  persona vẫn NOT_RUN; file v1 dirty từ trước không được stage.

## Cập nhật 2026-09-14 10:56 ICT — W2-ROADMAP-EDITOR-SNAPSHOT: FINAL APPROVE, PASS

- Implementation/test-only SHA: `f9f3e405c469d201859c85d1647eb4d6aa73c0ce`; product fix kế
  thừa từ `f5d7fb0`, RED pre-fix `c1148d6` giữ làm lineage evidence.
- Reviewer độc lập final APPROVE, 0 P0/P1/P2; P2 duy nhất đã CLOSED.
- Exact-commit gates: backend 678 passed/18 skipped trong 61.40s, Ruff/mypy sạch; frontend
  25 file/174 test, ESLint/tsc/build 17/17 sạch.
- Report chuẩn: `../reports/09-w2-roadmap-editor-snapshot/qa-report.json`. Slice đã chuyển sang
  completed PASS; W1 PASS và W2 IN_PROGRESS.
- Browser/Playwright/persona NOT_RUN. Docs/ledger dành cho docs commit riêng; v1 vẫn ngoài phạm
  vi và không được stage.

## Cập nhật 2026-09-14 11:25 ICT — W2-CAREER-GOAL-CAS: chờ review độc lập

- Candidate chưa commit trên base `458768fc4261303909d2dc2c90664cdd8d0f19ae`; chỉ thay đổi
  Career Goal trong `v2/`. Không chạy Playwright/browser và không đụng file v1 dirty từ trước.
- Product fix frontend: nhận diện 409 `version_conflict`, giữ draft/confirmation, refetch goal
  server, reset mutation khi cancel/reopen và dùng snapshot version mới.
- Evidence: frontend RED 2 fail/2 pass, GREEN 4/4; backend + migration focused 4 pass/1
  PostgreSQL-only skip; Ruff/ESLint/tsc/diff-check sạch.
- Reviewer cần kiểm tra CAS atomic + owner/company scope, độ chính xác test 409/refetch/reset và
  chạy test PostgreSQL hai writer cùng full non-browser gates trước khi chuyển PASS.

### Remediation review 11:34 ICT

- `P1-1`, `P2-1`, `P2-2` đã `FIXED_PENDING_REREVIEW`: await refetch thật và wording failure,
  assertion reset bằng regex, DB barrier với hai session/client và timeout.
- Fresh focused gates: frontend 5/5; backend 4 pass/1 PostgreSQL-only skip trong 1.02s;
  Ruff/ESLint/TypeScript PASS. Candidate vẫn chưa commit/push; browser NOT_RUN.

## Cập nhật 2026-09-14 12:09 ICT — W2-CAREER-GOAL-CAS: FINAL APPROVE, PASS

- Implementation/test SHA `08b0cd6c6cac1c91f2a9c284a4d00a1fdf8ae9ea`; independent reviewer
  **FINAL APPROVE, 0 P0/P1/P2** và đóng đủ ba finding.
- PostgreSQL focused 4 passed/3.64s; backend SQLite full 680 passed/19 skipped/82.42s; Ruff và
  mypy app 90 files PASS.
- Frontend 25 file/177 test; ESLint, typecheck và Next build static generation 17/17 PASS.
- Report chuẩn: `../reports/10-w2-career-goal-cas/qa-report.json`. Active assignment đã xóa,
  completed slice chuyển PASS; W2 giữ IN_PROGRESS. Browser/Playwright/persona NOT_RUN.

## Cập nhật 2026-09-14 12:38 ICT — W2-CAREER-PLAN-SNAPSHOT: PENDING_REVIEW

- Base/current HEAD `450478b2ce59c3f8bd8ed64a2f4e9488b419f2c4`; candidate chỉ thay đổi trong
  `v2/`, chưa stage/commit/push và chưa chạy browser/Playwright.
- Draft kế hoạch snapshot content/summary/aiGenerated/category/expectedVersion tại lúc mở draft
  hoặc nhận AI proposal. PUT không đọc history cache lúc submit. 409 giữ draft, await active
  history refetch, khóa Lưu/Bỏ draft trong recovery và reopen dùng version mới.
- Reviewer vòng đầu nêu 3 P2, 0 P0/P1; cả ba ở `FIXED_PENDING_REREVIEW`. Focused frontend 9/9;
  backend SQLite 2 pass/1 PostgreSQL-only skip; Ruff/ESLint/tsc PASS.
- PostgreSQL barrier test dùng hai client/session, chặn trước production `SELECT FOR UPDATE`, yêu
  cầu một winner v1, một structured 409 currentVersion=1 và đúng một history row. Local PostgreSQL
  cô lập hiện không hoạt động nên chưa có runtime PASS cho test này.
- Report nháp: `../reports/11-w2-career-plan-snapshot/qa-report.json`. Task chỉ ở
  `active_assignments`; chờ independent re-review rồi mới chạy full non-browser gates.

## Cập nhật 2026-09-14 12:42 ICT — W2-CAREER-PLAN-SNAPSHOT: FINAL APPROVE, PASS

- Implementation/test SHA `528900a9a773d9d0f3533674b8f6cd75eb29b204`; independent reviewer
  FINAL APPROVE, 0 P0/P1/P2 và xác nhận cả 3 P2 đã CLOSED.
- PostgreSQL focused 3 passed/2.00s; backend SQLite full 682 passed/20 skipped/83.97s; Ruff
  và mypy app 90 source files PASS.
- Frontend 25 file/181 test; ESLint, typecheck và Next build static generation 17/17 PASS.
- Report chuẩn gồm `../reports/11-w2-career-plan-snapshot/qa-report.json`, `README.md` và
  `report.html`. Active assignment đã xóa, completed slice chuyển PASS; W2 giữ IN_PROGRESS.
- Browser/Playwright/persona vẫn NOT_RUN. Docs/ledger chờ docs commit riêng; không có code/test
  nào thay đổi sau implementation SHA và file v1 dirty từ trước vẫn ngoài phạm vi.

## Cập nhật 2026-09-14 15:06 ICT — W2-AI-ROADMAP-GROUNDING: PENDING_REVIEW

- Base/current HEAD `3dacef69062425ded6c556c156770b997839f036`; candidate chưa stage/commit/push.
- Entry point `POST /api/v2/assistant/query` với focus `ROADMAP` nay dùng schema grounding riêng,
  allowlist actor/source/evidence và fail closed trước khi tạo conversation/message/domain row.
- Proposal hợp lệ chỉ có trong response tạm; DB assistant message giữ `proposal_data=NULL`.
  Frontend lấy proposal từ response để mở editor; save roadmap vẫn là hành động xác nhận riêng.
- Backend focused 18 passed, Ruff/mypy PASS; frontend focused 1 test và ESLint PASS. Full
  TypeScript bị chặn bởi dirty dashboard test ngoài phạm vi tại `tests/live-dashboard.test.tsx:96`.
- Reviewer cần xem semantic claim-evidence gap và việc evidence token hiện ở mức profile snapshot,
  sau đó chạy full non-browser gates. Browser/Playwright/persona NOT_RUN theo chỉ đạo.
- Report: `../reports/12-w2-ai-roadmap-grounding/qa-report.json`. Task chỉ nằm trong
  `active_assignments` với trạng thái `PENDING_REVIEW`; chưa thêm vào `completed_slices`.

### Remediation review 2026-09-14 15:19 ICT

- `P1-1` và `P2-1` đều `FIXED_PENDING_REREVIEW`; không có P0.
- Unsaved proposal không thể bị thay bởi query/navigation mới; lưu hoặc bỏ là boundary rõ ràng.
  Mỗi proposal mới reset save mutation trước khi cài và editor có key theo save intent.
- Frontend focused 2/2 PASS, ESLint PASS. Full TypeScript blocker vẫn là dirty dashboard test
  bị cấm sửa; backend không đổi sau evidence 18/18 + Ruff/mypy PASS.
- Candidate chưa commit/push, task vẫn chỉ ở `active_assignments` PENDING_REVIEW. Chờ re-review.

## Cập nhật 2026-09-14 15:52 ICT — W2-AI-ROADMAP-GROUNDING: FINAL APPROVE, PASS

- Implementation `546d5786be900ce003e768ed4602a4015701bb90`; integrated verification
  `c0a1fee65fcc66f3e1e4241252b5b1a7cd4645c4` chứa AI implementation không đổi và dashboard
  commit đã được duyệt riêng.
- Independent final review APPROVE, 0 P0/P1/P2; `P1-1` và `P2-1` CLOSED.
- Full non-browser gates trên verification SHA: backend 694 passed/20 skipped/71.47s,
  Ruff/mypy PASS; frontend 27 files/190 tests/10.43s, lint/typecheck/build 17/17 PASS.
- Active assignment đã xóa, completed slice chuyển PASS; W2 giữ IN_PROGRESS. Docs/ledger chờ
  commit riêng. Browser/Playwright/persona và provider live NOT_RUN.
- Hạn chế còn lại: evidence token chưa phải SourceBlock citation lâu dài; allowlist chưa tự kiểm
  tra mức phù hợp ngữ nghĩa giữa claim và evidence.

## Cập nhật 2026-09-14 15:57 ICT — W5-DASHBOARD-ROLE-AWARE-PROGRESS: FINAL APPROVE, PASS

- Dashboard implementation và verification cùng tại SHA
  `c0a1fee65fcc66f3e1e4241252b5b1a7cd4645c4`; docs được tạo trên base
  `84cbf51e012cb5370fdaaea3a4989d10fc43195a`. Independent review FINAL APPROVE,
  0 P0/P1/P2.
- Role/view authoritative từ backend: BOD/HR có personal + management; EMPLOYEE chỉ personal;
  COMPANY_ADMIN/SUPER_ADMIN chỉ management. Quick check-in không được cấp ngầm và chỉ xuất hiện
  khi có `roadmap:self`.
- CAS quick check-in khóa toàn bộ task trong dialog, chặn click đồng thời, await refetch trước unlock và phục
  hồi typed 409 bằng dữ liệu mới. Skill dialog chỉ còn rating đã lưu; segmented switcher có
  `aria-pressed` và `min-h-11`; nhãn roadmap là **Tổng lộ trình**.
- Exact-SHA gates: backend 694 passed/20 skipped/71.47s, Ruff/mypy 90 files PASS; frontend
  27 files/190 tests/10.43s, ESLint/typecheck/build 17/17 PASS.
- Report: `../reports/13-dashboard-role-aware-progress/qa-report.json`. Browser/Playwright/
  persona/axe/visual regression NOT_RUN theo chỉ đạo. Chỉ slice dashboard W5 PASS; toàn W5 vẫn
  IN_PROGRESS vì Smart People Search, staffing và các phần khác còn mở. Không commit/push trong
  lượt docs-only này.

## Cập nhật 2026-09-14 16:31 ICT — W3-ASSESSMENT-SCORING-INVARIANTS: FINAL APPROVE, PASS

- Implementation/verification SHA `f465af6bac2c6a30059fc791895db46a08d5952c`; independent
  final review **APPROVE, 0 P0/P1/P2**. P1 missing scoring fields và hai P2 numeric-string
  compatibility/duplicate group coverage đều CLOSED.
- Deterministic contract: `answer/maxScore*10`; weighted question → group; weighted group →
  dimension/total; Decimal `ROUND_HALF_UP` 2 decimals. Dimension không có dữ liệu trả `null`.
- Approve recompute từ immutable `template_snapshot` + persisted `answers`. Snapshot thiếu field,
  answer/ID/range/weight sai hoặc malformed legacy value đều fail closed 422; numeric string
  legacy hợp lệ tiếp tục cho cùng kết quả.
- Exact-SHA evidence: focused scoring 33 PASS; scoring+offboarding 38 PASS; backend full 719
  passed/20 skipped/68.48s; Ruff PASS; mypy app 90 files PASS; frontend 27 files/190 tests/
  14.74s, ESLint/typecheck PASS; build 17/17 routes/12.66s.
- Report: `../reports/14-w3-assessment-scoring-invariants/qa-report.json`. Browser/Playwright/
  persona/axe/visual regression NOT_RUN. Slice không thêm hoặc thay đổi `passportDimension`
  mapping và không dùng AI scoring.
  W3 giữ IN_PROGRESS vì các assessment flows còn lại chưa hoàn tất. Legacy row sai cần audit/
  repair trước migration nếu tồn tại. Lượt này docs-only, không commit/push.

## Cập nhật 2026-09-14 17:33 ICT — W3-ASSESSMENT-APPROVAL-TRANSACTION: FINAL APPROVE, PASS

- Implementation/verification `565ba21060a8bf317ae4298dcf31fddd974134d7`; supporting focus fix
  `067eab324ad0672f4e45d3e34e51155f8c0525cc`; independent review APPROVE 0 P0/P1/P2.
- Approve/reject/request-revision dùng row lock, expectedVersion và typed 409. Tenant, permission
  và self-approval fail closed. Approve recompute từ immutable snapshot; AI không tính điểm.
- Transition + score/approval metadata + metadata-only audit nguyên tử; audit failure rollback.
  PostgreSQL concurrent approve xác minh một 200, một 409 currentVersion và một audit row.
- Frontend nút Yêu cầu chỉnh sửa gọi `/request-revision`, không gọi `/reject`; reset Assessment
  Builder không giành lại focus do người dùng đã chuyển.
- Exact gates: PG focused 11; backend 729 passed/21 skipped; Ruff/mypy PASS; frontend 28 files/
  191 tests, lint/typecheck/build 17/17 PASS. Browser/Playwright/persona/provider NOT_RUN.
- Slice đã ở completed PASS; W3 tiếp tục IN_PROGRESS. Docs/ledger chưa stage/commit/push.
