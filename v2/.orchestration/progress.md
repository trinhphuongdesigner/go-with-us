# Tiến độ CareerMate v2

## 2026-09-12 01:00 ICT

- Đã tạo recovery manifest, tracked patch và untracked archive trong `/private/tmp`.
- Đã fetch `origin/master` và tạo worktree sạch từ SHA `48afb1ba4bb916d56cbfc95ac3264ad540587da7`.
- Đã tạo Codex goal và Pi Desktop session `CareerMate v2 Full Rebuild`.
- Pi goal mode bị kẹt trước khi ghi file; đã chuyển sang agent mode, giữ ledger này làm nguồn trạng thái bền.
- Pi đang triển khai backend/auth/AI foundation; frontend đang được triển khai trong worktree riêng.
- Antigravity đã tạo checklist App Shell/Auth ở trạng thái PENDING; chưa có UI v2 để nghiệm thu.
- Đã chuẩn bị contract Wave 1, AI contract, 33 golden eval cases và report schema bằng dữ liệu giả.

Tại checkpoint 01:00 ICT chưa có feature nào PASS; trạng thái mới hơn nằm bên dưới.

## 2026-09-12 06:00 ICT

- Wave 0 PASS tại implementation SHA `01e1e87838d9cd4473a0e661b6dd75291b5119e6`, tree `b7615d6b60b05c02af7197b176f14e54b6dad526`.
- Backend PASS 111 test PostgreSQL; frontend PASS 12 Vitest và 27 Playwright production trên 3 viewport.
- Alembic, OpenAPI/client drift, Ruff, mypy, ESLint, TypeScript, build, audit và Gitleaks đều PASS.
- Security scan `20cf79c3-cc35-4b26-b99b-06dd7e616c33` bao phủ 80/80 inventory, 0 finding.
- LCP: 727 ms mobile, 703 ms tablet, 770 ms desktop; axe 0 violation.
- Antigravity correction xác nhận P0/P1 mở bằng 0, 5 persona PASS; ba P2 chuyển backlog.
- 33 AI golden declaration hợp lệ; provider behavior vẫn NOT_RUN.
- Báo cáo chuẩn ở `v2/reports/00-foundation/qa-report.json`.
- Wave 1 chuyển sang IN_PROGRESS; bước kế tiếp là contract freeze Employee 360/import.

## 2026-09-12 09:58 ICT

- Slice `W1-IMPORT` PASS tại implementation SHA `de246d8c74ec8425cec0172613012fc600811719`, tree `27ef3bafeb15c887ab167fcf34d1dc35a45f3a39`.
- Backend PASS 205 test PostgreSQL và 196 test SQLite; 9 case PostgreSQL-only được skip đúng trên SQLite.
- Frontend PASS 21 Vitest và 36 Playwright production trên 390×844, 768×1024 và 1440×900; axe 0 vi phạm.
- Ruff, mypy, ESLint, TypeScript, Next.js production build, Alembic drift, OpenAPI/client, Bandit, dependency audit và Gitleaks đều PASS.
- Review backend/concurrency độc lập APPROVE với 0 P0/P1. Antigravity correction review xác nhận UI/UX PASS với 0 P0/P1/P2 sau khi sửa 6 phát hiện.
- 7 screenshot mới có checksum trong manifest. Đây là bằng chứng Demo UX, không phải bằng chứng provider/backend live.
- Report chuẩn ở `v2/reports/01-employee-360-import/qa-report.json`.
- Wave 1 vẫn IN_PROGRESS; bước kế tiếp là profile aggregate, kỹ năng/kinh nghiệm/dự án/chứng chỉ/giải thưởng/timeline và roster HR.

## 2026-09-12 11:00 ICT

- Slice `W1-CORE` PASS tại implementation SHA `ca230bceb3b2d9be473fa8f842b23ecd51379115`, tree `052b9d39877cfe584033bf2c574594495df79497`.
- Backend PASS 212 test PostgreSQL; frontend PASS 40 Vitest và 60 Playwright production trên 390×844, 768×1024 và 1440×900.
- Ruff, mypy, ESLint, TypeScript, Next.js production build, Alembic upgrade/drift, OpenAPI/client, Bandit, dependency audit và Gitleaks đều PASS.
- Independent backend, concurrency và UI/persona review cùng bind đúng exact SHA; P0/P1 UI mở bằng 0. P2 company-options scalability được ghi vào backlog.
- Đã đóng lỗi cache detail chéo phiên/tenant, contract 400/422, page quá lớn, roster index, tenant override và hai nút xóa tìm kiếm.
- 8 screenshot production mới có checksum, tree, account và rendered size trong manifest; ảnh super-admin đầy đủ shell/selector/content.
- Report chuẩn ở `v2/reports/02-core-profile-roster/qa-report.json`.
- Wave 1 vẫn IN_PROGRESS; bước tiếp theo là CRUD skill, experience, project, certification, award, provenance và unified timeline.

## 2026-09-12 23:28 ICT — hợp nhất và tạm dừng

- Worktree chuẩn để hợp nhất là `.claude/worktrees/v2-qa`, branch `codex/v2-qa-consolidation`.
- Đã merge checkpoint mới nhất của `origin/master` vào candidate và gom các commit/worktree feature có nguồn gốc xác định. Checkout `master` bẩn vẫn được giữ nguyên; recovery snapshot nằm dưới `/private/tmp/careermate-consolidation-20260912-132308`.
- Candidate hiện ở HEAD `c1148d6cda34981c7ae59dce5521e06363e744b6` và còn nhiều thay đổi runtime chưa commit. Vì vậy không có SHA duy nhất chứng minh toàn bộ trạng thái hiện tại.
- Review tĩnh đã khóa một snapshot gồm 255 file, 54.525 dòng diff, SHA-256 `8c1bd02ca635f5b77b2764cdf76cc990b804cc6705391bf276a52d0dc47bb462`.
- Review xác nhận 1 P0, 31 P1 và 5 P2. P0 là delegated role editor có thể cấp quyền `FULL`; P1 tập trung vào RBAC/tenant, optimistic locking, AI evidence/scoring, migration parity và performance.
- Báo cáo chuẩn: `../docs/consolidation-static-review-2026-09-12.vi.md`.
- Theo yêu cầu của user, toàn bộ coding, test runtime và Playwright đang dừng. Task runtime liên quan đã nhận handoff và kết thúc ở trạng thái idle.
- Candidate chưa được phép bàn giao tester chức năng. Khi được cho phép tiếp tục, xử lý P0/P1 trước, tạo clean commit SHA, rồi chạy lại quality gates trên đúng SHA đó.

## 2026-09-13 02:07 ICT — remediation tiếp tục

- Đã khép optimistic locking cho CareerGoal PATCH/DELETE, giữ partial PATCH và version snapshot từ frontend.
- Offboarding không còn nhận dimension score do AI sinh; điểm lấy từ immutable assessment snapshot có `passportDimension` rõ ràng. Citation thiếu/lạ fail-closed trước persistence.
- Job matching đã chuyển hard filter, scoring và sorting về backend; skill query được batch, AI chỉ giải thích bằng skill ID allowlist.
- Profile HR tách assessment averages đã duyệt khỏi điểm ghi nhận thủ công; màn duyệt Passport hiển thị đủ dữ liệu sắp đóng băng.
- Working-tree gate: backend 642 passed/18 skipped trên SQLite; frontend Vitest, ESLint, TypeScript và Next production build PASS; OpenAPI client current; diff check PASS.
- Playwright vẫn NOT_RUN theo yêu cầu. PostgreSQL/migration và exact-SHA gate chờ candidate được commit sạch.
- Chi tiết: `../docs/consolidation-remediation-2026-09-13.vi.md`.

## 2026-09-13 10:23 ICT — khép P0/P1 và kiểm tra PostgreSQL sạch

- Independent read-only review đã APPROVE remediation hiện tại, không còn P0/P1 có thể hành động trong phạm vi 1 P0 và 31 P1 ban đầu.
- Đã khép contract/concurrency của CareerGoal, deterministic assessment/passport scoring, offboarding evidence/pseudonymization, backend-owned staffing score, canonical AI roster answer, RAG cap/rank và URL import deadline.
- RAG dùng exact token thống nhất giữa PostgreSQL/SQLite/Python, xử lý dấu tiếng Việt, `Đ/đ`, Unicode decomposed, Unicode delimiter và raw offset cho evidence dài. Regression bao phủ substring/evidence crowding trên hơn 200 hồ sơ.
- Backend trên SQLite: 655 passed, 18 skipped. Backend trên PostgreSQL 17 sạch sau Alembic `0001` → `0018`: 673 passed; `alembic check` không drift.
- Ruff/lint/format, mypy toàn app, OpenAPI/client generation, TypeScript, ESLint, 148 Vitest, Next.js production build, Bandit, pip-audit và npm production audit đều PASS.
- PostgreSQL cũ ở cổng 55432 có migration stamp `0004` nhưng schema từng bị metadata tạo thêm bảng; không dùng làm evidence và không xóa/truncate. Verification dùng database cô lập ở cổng 55441.
- Candidate vẫn dirty tại base HEAD `c1148d6cda34981c7ae59dce5521e06363e744b6`; chưa có exact implementation SHA. Playwright vẫn NOT_RUN theo yêu cầu user, nên chưa bàn giao tester chức năng.
- Chi tiết: `../docs/consolidation-remediation-2026-09-13.vi.md`.

## 2026-09-13 10:28 ICT — khóa implementation SHA

- Đã commit riêng source/backend/frontend/contracts/test v2 tại SHA `f5d7fb093f0cd7f577131111222bcd2d8a43459c`; không stage bất kỳ thay đổi v1 nào ở root.
- `contracts:check` sau commit xác nhận generated TypeScript contract current; source tree của implementation sạch và byte-identical với snapshot đã chạy test/review.
- Report, handoff và orchestration được chuẩn bị cho commit tài liệu riêng. Tester handoff vẫn ghi rõ Playwright NOT_RUN và Gitleaks exact-SHA chưa có binary.

## 2026-09-13 10:36 ICT — push candidate và mở manual QA

- Đã push `codex/v2-qa-consolidation`; remote head sau commit report/handoff là `0ef9f94575592b37d20d8226c3a46dfbb22938bf`.
- Implementation cần kiểm tra vẫn là `f5d7fb093f0cd7f577131111222bcd2d8a43459c`; report và toàn bộ check runtime trỏ về SHA này.
- Manual tester có thể bắt đầu trên branch đã push. Overall report vẫn `BLOCKED` vì Playwright/accessibility/performance/persona NOT_RUN theo yêu cầu và Gitleaks chưa có binary.
- Các thay đổi v1 ngoài phạm vi vẫn được giữ nguyên, không stage hoặc đưa vào commit v2.

## 2026-09-13 14:00 ICT — đóng gap Gitleaks exact-SHA

- Đã cài `gitleaks v8.30.1` (brew) và chạy `gitleaks git --log-opts="f5d7fb093f0cd7f577131111222bcd2d8a43459c"` trên implementation SHA đã khóa: 56 commit, 5 finding.
- Đối chiếu thủ công từng finding (không in giá trị secret thô): Figma file key công khai trong `docs/careermate-milo-sage/figma-audit.json`, placeholder token demo trong `careermate-preview.html`, badge URL mẫu chuẩn NestJS trong `backend/README.md`, hằng số test trong `v2/backend/app/people_search/smoke.py`. Cả 5 đều false positive, không có secret thật.
- Cập nhật `../reports/03-consolidation-remediation/qa-report.json` (CHK-SECURITY bổ sung bằng chứng Gitleaks, xoá known_gap tương ứng) và `tasks.json` (bỏ phần Gitleaks khỏi blocker của `CONSOLIDATION-REMEDIATION`).
- `overall_status` của report vẫn `BLOCKED` vì Playwright/accessibility/performance/persona vẫn NOT_RUN theo chỉ dẫn tạm dừng của user — không tự đổi.
- Không chạy Playwright/browser/persona test. Không đụng tới thay đổi v1 đang dirty ở root.

## 2026-09-13 14:39 ICT — W1-EXPERIENCE-TIMELINE hoàn tất

- Task duy nhất được giao: review/cải thiện Experience CRUD + mốc Experience trong career timeline hợp nhất (không chạm project/cert/award/goal/assessment/passport/staffing).
- Backend: logic CRUD/authz/CAS/validate/activity-log trong `competency_profile_service.py` và `competency_profile.py` đã đúng, không cần rewrite. Bổ sung `test_timeline_orders_same_day_experiences_deterministically_by_id` vào `v2/backend/tests/test_competency_profile_api.py` để lấp khoảng trống evidence cho tie-break ordering. Suite đầy đủ: 656 passed, 18 skipped.
- Frontend: `profile-view.tsx` chưa có test Vitest nào cho Experience CRUD. Thêm file mới `v2/frontend/src/features/profile/profile-view.experience.test.tsx` (4 test: tạo, sửa, xóa 2-bước xác nhận, 409 conflict khóa form) — không sửa component sản phẩm. Suite đầy đủ: 21 file/152 test passed. Lint/typecheck/build đều sạch.
- 2 lượt review độc lập (code-reviewer subagent) xác nhận test đúng logic và DOM selector khớp thực tế, không có finding cần sửa; tự chạy lại suite làm bằng chứng khách quan bổ sung do cả 2 lượt review chạm giới hạn turn trước khi xuất báo cáo dài.
- Viết báo cáo `../reports/04-w1-experience-timeline/qa-report.json` (verdict PASS, AC-01..AC-05), cập nhật `tasks.json` (thêm slice `W1-EXPERIENCE-TIMELINE`, cập nhật runtime sqlite/frontend_vitest).
- Không chạy Playwright/browser/persona test. Không đụng tới các file v1 đang dirty ở root.

## 2026-09-13 16:20 ICT — W1-PROJECT-TIMELINE hoàn tất

- Task duy nhất được giao: review/cải thiện Project CRUD + mốc Project trong career timeline hợp nhất (không chạm experience/cert/award/goal/assessment/passport/staffing).
- Backend: Project dùng chung generic resource pipeline với Experience (`resolve_target`, `_profile_cas`, `create_resource`/`update_resource`/`delete_resource`, `_validate_combined_dates`) trong `competency_profile_service.py` và `competency_profile.py`; `ProjectCreate`/`ProjectPatch` trong `competency_schemas.py` đã validate/dedupe `techStack` đúng trên cả Create lẫn Patch. Logic đã đúng, không cần rewrite. Bổ sung 4 test vào `v2/backend/tests/test_competency_profile_api.py`: vòng đời CRUD+provenance+activity-log đầy đủ, tenant-scoping riêng cho `/projects`, tie-break timeline theo id, rollback khi audit log thất bại giữa update/delete. Suite đầy đủ: 660 passed, 18 skipped (tăng 4 so baseline 656).
- Frontend: `profile-view.tsx` chưa có test Vitest nào cho Project CRUD (fixture cũ khai `projects: []`). Thêm file mới `v2/frontend/src/features/profile/profile-view.project.test.tsx` (4 test: tạo kèm techStack tách dấu phẩy, sửa, xóa 2-bước xác nhận, 409 conflict khóa form) — không sửa component sản phẩm. Suite đầy đủ: 22 file/156 test passed (tăng từ 21/152). Lint/typecheck/build đều sạch.
- **Giới hạn**: Task tool (subagent delegation) không khả dụng trong phiên này ("currently unavailable") — không delegate được review độc lập thật sự. Thay bằng self-review nghiêm ngặt đối chiếu từng tiêu chí với code thực tế + chạy lại toàn bộ quality gate làm bằng chứng khách quan. Đã ghi rõ giới hạn này trong report, không che giấu.
- Viết báo cáo `../reports/05-w1-project-timeline/qa-report.json` + `README.md` (verdict PASS kèm giới hạn, AC-01..AC-05), cập nhật `tasks.json` (thêm slice `W1-PROJECT-TIMELINE`).
- Không chạy Playwright/browser/persona test. Không đụng tới các file v1 đang dirty ở root (xác nhận `git status --short` giống hệt trước/sau task, chỉ thêm 2 file trong `v2/`).

## 2026-09-13 09:30 ICT — W1-PROJECT-TIMELINE: sửa 2 finding từ review độc lập

- Reviewer độc lập (bên ngoài phiên Pi) review base `65507c6`, verdict **REQUEST_CHANGES**
  với 2 finding: P1 — `ProfileResourceEditForm` không đóng/không remount sau
  `reloadProfile()`, cho phép resubmit draft cũ kèm `profileVersion` mới, âm thầm ghi đè
  thay đổi đồng thời trên server thay vì báo xung đột; P2 — test
  `test_project_update_and_delete_roll_back_when_audit_fails` chỉ phủ nhánh update, thiếu
  delete dù tên ngụ ý cả hai.
- Đã sửa cả 2: `reloadProfile()` gọi thêm `setEditingResourceId(null)`; `ProfileResourceEditForm`
  gắn `key={`${resource.id}:${profile.profileVersion}`}` để remount với dữ liệu server mới
  nhất; test rollback được parametrize `["update", "delete"]`. Thêm 1 test hồi quy frontend
  xác minh fail-without-fix/pass-with-fix cho P1.
- Commit code+test: `f845494ef9939a6bf574fc74fb379003b3d68abf` — "fix(v2): prevent stale
  project overwrite after reload".
- Chạy lại toàn bộ gate: backend 661 passed/18 skipped (baseline 656), frontend 157
  passed/22 file (baseline 152/21), ruff/mypy/eslint/tsc/next-build đều sạch.
- Reviewer độc lập re-review đúng nội dung fix, xác nhận CLOSED, không còn P0/P1/P2,
  `git diff --check` sạch, verdict **PASS**.
- Cập nhật `qa-report.json`/`README.md` (verdict PASS, SHA mới, số liệu test mới) và
  `tasks.json`/`handoff.md` để tham chiếu SHA `f845494ef9939a6bf574fc74fb379003b3d68abf`.

## 2026-09-14 00:00 ICT — W1-CERTIFICATION-TIMELINE: sửa 2 finding P2, chờ re-review

- Task duy nhất được giao: review/cải thiện Certification CRUD + mốc Certification trong career timeline hợp nhất (không chạm experience/project/award/goal/assessment/passport/staffing).
- Logic sản phẩm đã đúng từ trước (dùng chung pipeline generic đã xác minh ở report 04/05) — không sửa code sản phẩm, chỉ bổ sung 4 test backend và 1 file test frontend còn thiếu (test_competency_profile_api.py +328 dòng net, profile-view.certification.test.tsx mới 295 dòng, 5 test).
- Reviewer độc lập (bên ngoài phiên Pi) review candidate ban đầu, verdict **REQUEST_CHANGES** với đúng 2 finding, cả hai P2 (không P0/P1): P2-1 — test frontend create/edit chỉ phủ giá trị mặc định (type=PROFESSIONAL), không chứng minh field Certification-specific khác được map đúng; P2-2 — test timeline chỉ assert thứ tự/loại trừ, thiếu assert field mapping đầy đủ (kind/title/subtitle/startDate/endDate/sourceType) cho từng item.
- Đã sửa cả 2: test create nay chọn type=LANGUAGE và assert payload; test edit nay đổi đồng thời type/score/expiresAt/credentialUrl ngoài name; test timeline nay assert đầy đủ field chiếu cho cả 2 item còn lại (bao gồm endDate khớp expiresAt); đồng thời sửa fixture frontend baseProfile().timeline[0].endDate từ null thành "2028-01-01" để khớp expiresAt thật của certification (bug fixture nội bộ, reviewer chỉ ra kèm P2-2).
- Chạy lại toàn bộ gate không-browser sau khi sửa: backend 666 passed/18 skipped (không mất/trùng test), ruff/mypy sạch, frontend 162 passed/23 file, lint/typecheck/build sạch, `git diff --check` sạch.
- Viết báo cáo `../reports/06-w1-certification-timeline/qa-report.json` + `README.md` với `overall_status: "P2_FIXED_PENDING_REREVIEW"` (KHÔNG PASS vì chưa có re-review độc lập xác nhận CLOSED), cập nhật `tasks.json` (thêm slice `W1-CERTIFICATION-TIMELINE` cùng trạng thái).
- Không chạy Playwright/browser/persona test. Không đụng tới các file v1 đang dirty ở root. Chưa `git add`/commit/push — dừng ở working tree theo đúng chỉ đạo, chờ reviewer độc lập re-review.


## 2026-09-14 01:00 ICT — W1-CERTIFICATION-TIMELINE: FINAL APPROVE, commit test-only, cập nhật docs

- Sau 2 vòng re-review docs-only (chỉ để khớp evidence chính xác với hành vi test thật, không
  có finding về code/test), reviewer độc lập ra verdict cuối cùng: **FINAL APPROVE, 0 P0/P1/P2**.
- Commit test-only tại `d258d8759678b0eaaa0b5f4be437989040bdf306` (`test(v2/profile): cover certification CRUD and timeline`), gồm
  đúng 2 file: `v2/backend/tests/test_competency_profile_api.py` và
  `v2/frontend/src/features/profile/profile-view.certification.test.tsx`. Không đụng file v1.
- Cập nhật `qa-report.json`/`README.md` (`overall_status`/trạng thái báo cáo → `PASS`,
  `implementation_sha`/`verified_tree_sha` → `d258d8759678b0eaaa0b5f4be437989040bdf306`, AC-05/CHK-10 → PASS/CLOSED, known_gaps chỉ
  còn Playwright NOT_RUN), `tasks.json` (slice `W1-CERTIFICATION-TIMELINE` → `PASS`,
  `implementation_sha`, `current_task_runtime`), `handoff.md` (thêm mục cập nhật FINAL APPROVE).
- Test counts không đổi so với lần chạy trước khi commit: backend 666 passed/18 skipped, frontend
  162 passed/23 file. Playwright/browser/persona vẫn NOT_RUN — không claim đã chạy.
- Docs (qa-report.json/README.md/tasks.json/progress.md/handoff.md) được `git add`/commit riêng
  khỏi commit test, theo đúng yêu cầu tách commit.

## 2026-09-14 09:44 ICT — W1-AWARD-TIMELINE: focused gates, chờ review

- Base HEAD `2fc53c80156e7697d0de715a44d3fc7b40772ceb`, branch
  `codex/v2-qa-consolidation`; các thay đổi thuộc slice W1-AWARD chỉ nằm trong `v2/` và chưa
  stage/commit/push. Những file v1 ở root đã dirty từ trước vẫn ngoài phạm vi và chưa stage.
- Pi Desktop MCP tạo `profile-view.award.test.tsx`; focused Vitest chạy lại 5/5, gồm retry sau
  409 giữ `reloadedProfile` qua invalidate/refetch và chờ trạng thái lưu thành công. Provider Pi sau đó trả 403 nên backend test
  được hoàn thiện trong cùng worktree bởi agent điều phối, không đổi cấu hình hay credential.
- Backend bổ sung evidence riêng cho Award: stale create/update/delete đều trả 409 cùng
  `currentProfileVersion`; mapping `WORK` → `PERSONAL`; required Patch fields; tenant/permission;
  `SELF`/`ADMIN`, `selfReported`; rollback audit update/delete; timeline tie-break theo id và loại
  Award thiếu `awardedAt`.
- Focused gate sau khi sửa P2 review: backend `10 passed, 681 deselected`; frontend `5 passed`; Ruff file test và
  `git diff --check` sạch.
- Trạng thái `PENDING_REVIEW`: chưa chạy review độc lập hoặc full non-browser suites. Playwright,
  browser và persona tiếp tục `NOT_RUN` theo chỉ đạo.
- Report nháp: `../reports/07-w1-award-timeline/qa-report.json`.

## 2026-09-14 10:00 ICT — W1-AWARD-TIMELINE: FINAL APPROVE, PASS

- Implementation/test đã commit tại `4c994e02192e104ccf1aeffddb740237e81dfa39`
  (`test(v2/profile): verify award timeline workflow`), gồm đúng backend Award tests và frontend
  `profile-view.award.test.tsx`.
- Reviewer độc lập final **APPROVE**, 0 P0/P1/P2. Ba finding P2 đều CLOSED: mock reload giữ
  `reloadedProfile` qua invalidate/refetch và chờ trạng thái lưu; test edit thay đổi thật
  `issuer`/`awardedAt`; docs phân biệt rõ slice `v2/` với root v1 dirty từ trước.
- Full non-browser gates trên exact implementation commit: backend 673 passed/18 skipped trong
  89.29s; Ruff sạch; mypy sạch trên 90 source files; frontend 167 tests/24 files; ESLint, tsc và
  Next production build 17 pages/routes đều PASS.
- Playwright/browser/persona vẫn NOT_RUN theo chỉ đạo. Năm file report/ledger được lưu bằng commit
  tài liệu riêng ngay sau implementation; report ghim SHA đã chạy test.
- Các thay đổi thuộc slice W1-AWARD chỉ nằm trong `v2/`; file v1 ở root đã dirty từ trước vẫn
  ngoài phạm vi và không được stage.

## 2026-09-14 10:25 ICT — W1-SKILL-PROFILE: 4 P2 fixed, chờ re-review

- Candidate chưa commit trên base/current HEAD `abc89cf9e1be012598a7068db30b2d6b1187b38d`, branch
  `codex/v2-qa-consolidation`; chỉ file trong `v2/` thuộc slice này thay đổi. Các file v1 dirty
  từ trước vẫn ngoài phạm vi, không stage và không sửa.
- Reviewer vòng đầu nêu 4 P2. P2-1 được sửa bằng SUPER_ADMIN full-replace thật trên foreign
  tenant và assert persisted `company_id`, `ADMIN`, `selfAssessed=false`, actor. P2-2 được sửa
  bằng sequential stale replace chạy trên SQLite, assert 409 + `currentProfileVersion=2` và row
  đã commit không đổi.
- P2-3 đã chuyển task từ `completed_slices` sang `active_assignments`; coordination state ghi
  rõ candidate uncommitted, `implementation_source_clean=false`, docs pending. P2-4 đã sửa
  report: catalog POST persist ngay; chỉ association/rating/note ở hồ sơ là draft tới Save.
- Focused checkpoint hiện tại: backend 9 passed/6 PostgreSQL-only skipped/34 deselected;
  frontend 6/6; Ruff check, focused ESLint, TypeScript, JSON và diff-check sạch.
- Trạng thái vẫn `PENDING_REVIEW`: chưa chạy re-review hoặc full non-browser suites. Playwright,
  browser và persona `NOT_RUN` theo chỉ đạo.

## 2026-09-14 10:35 ICT — W1-SKILL-PROFILE: FINAL APPROVE, PASS

- Implementation và test đã commit tại `ac4b1a88b5f18d82ea21e60e4d9cc66d101bed5b`
  (`fix(v2/profile): reset stale skill edits after reload`). Reviewer độc lập ra verdict cuối
  **APPROVE, 0 P0/P1/P2**; cả bốn P2 vòng đầu đã CLOSED.
- Exact-commit backend gates, chạy từ `v2/backend`: `CAREERMATE_DEMO_LOGIN_ENABLED=false
  .venv/bin/pytest -q` → 678 passed/18 skipped trong 64.48s; `.venv/bin/ruff check .` → PASS;
  `.venv/bin/mypy app` → PASS trên 90 source files.
- Exact-commit frontend gates, chạy từ `v2/frontend`: `npm test` → 25 files/173 tests; `npm run
  lint`, `npm run typecheck` và `npm run build` đều PASS; Next static generation 17/17.
- Report `../reports/08-w1-skill-profile/qa-report.json`, README và ba ledger được chuẩn bị trong
  commit tài liệu riêng ngay sau implementation/test commit. Coordination state sau docs commit
  ghi `implementation_source_clean=true` và `documentation_commit_pending=false`.
- Playwright/browser/persona vẫn `NOT_RUN` theo chỉ đạo. Các file v1 dirty từ trước nằm ngoài
  phạm vi và không được stage.

## 2026-09-14 10:46 ICT — W2-ROADMAP-EDITOR-SNAPSHOT: focused gates, chờ review

- Base/current HEAD `12866da103e570c79978dd2c69f6103a52069492`, branch
  `codex/v2-qa-consolidation`; candidate chỉ thay đổi file dưới `v2/`, chưa stage/commit/push.
- Hai product fix snapshot chính đã có từ consolidation `f5d7fb0`: dialog xóa giữ
  `{id, version, title}`; editor giữ `Roadmap` snapshot, remount theo `id:version`, khóa task
  checkbox và reset mutation khi cancel/reopen.
- RED đã chạy thật trong worktree tạm tại pre-fix SHA `c1148d6`, dùng đúng hai test từ commit
  fix `f5d7fb0`: 2/2 fail đúng nguyên nhân. Delete gọi B v7 thay vì A v3; edit gửi version 4
  từ cache thay vì snapshot version 3. Worktree tạm đã được xóa sau kiểm tra.
- Bổ sung regression evidence cho title/selection của delete race và 409 preservation: draft
  giữ nguyên, selector/task checkbox bị khóa, reopen bỏ lỗi cũ và dùng version mới từ cache.
- P2 review về delete test đã sửa bằng deferred DELETE promise: assert request/nút pending trước,
  resolve response, chờ confirmation UI biến mất để chứng minh `onSuccess` đã chạy, rồi mới
  kiểm tra selection và heading B. Finding đang `FIXED_PENDING_REREVIEW`.
- Focused gates: Vitest `1 file, 3 tests passed`; focused ESLint PASS; TypeScript PASS;
  `git diff --check` sẽ được chạy lại sau cập nhật docs. Backend PUT/DELETE được audit tĩnh,
  không sửa backend và không claim fresh backend runtime test.
- `completed_slices` hiện chứng minh đủ W1 import/core/experience/project/certification/award/skill
  đều PASS, nên ledger chuyển W1 → PASS và W2 → IN_PROGRESS. Slice hiện vẫn
  `PENDING_REVIEW`, chưa chạy full non-browser suites hoặc review độc lập.
- Playwright/browser/persona/accessibility/performance tiếp tục `NOT_RUN` theo chỉ đạo; file v1
  dirty từ trước nằm ngoài phạm vi và không được stage.

## 2026-09-14 10:56 ICT — W2-ROADMAP-EDITOR-SNAPSHOT: FINAL APPROVE, PASS

- Regression test-only commit: `f9f3e405c469d201859c85d1647eb4d6aa73c0ce`. Product fix vẫn
  kế thừa từ consolidation `f5d7fb093f0cd7f577131111222bcd2d8a43459c`; RED lineage tại
  pre-fix `c1148d6cda34981c7ae59dce5521e06363e744b6` giữ nguyên làm evidence.
- Reviewer độc lập final **APPROVE, 0 P0/P1/P2**. P2 duy nhất về test chưa chờ `onSuccess` đã
  **CLOSED** bằng deferred DELETE response và confirmation-removed boundary.
- Exact-commit backend gates: `CAREERMATE_DEMO_LOGIN_ENABLED=false .venv/bin/pytest -q` →
  678 passed/18 skipped trong 61.40s; Ruff PASS; mypy PASS trên 90 source files.
- Exact-commit frontend gates: `npm test` → 25 file/174 test; ESLint, TypeScript và production
  build PASS; static generation 17/17.
- Slice chuyển từ active sang completed PASS; W1 giữ PASS, W2 giữ IN_PROGRESS. Report chuẩn:
  `../reports/09-w2-roadmap-editor-snapshot/qa-report.json`.
- Browser/Playwright/persona vẫn `NOT_RUN`. Report/ledger thuộc docs commit riêng ngay sau test
  commit; file v1 dirty từ trước nằm ngoài phạm vi và không được stage.

## 2026-09-14 11:25 ICT — W2-CAREER-GOAL-CAS: PENDING_REVIEW

- Base/current HEAD `458768fc4261303909d2dc2c90664cdd8d0f19ae`; candidate chưa stage,
  commit hoặc push. Mọi file thay đổi nằm trong `v2/`; file v1 dirty từ trước không bị đụng tới.
- Frontend RED xác nhận 2 failure đúng nguyên nhân: 409 chỉ hiện thông báo chung, không refetch/
  reset. Sau fix, 4/4 focused tests PASS: edit draft và delete confirmation được giữ, dữ liệu
  server được refetch, cancel/reopen reset lỗi và dùng version mới.
- Backend focused goal + migration contract: 4 passed, 1 PostgreSQL-only skipped. Bổ sung
  validation category/status/dueDate/progress/PATCH rỗng, owner + tenant scope và test hai writer
  nguyên tử dành cho PostgreSQL. Route/model/schema/migration product đã đúng từ `f5d7fb0`.
- Ruff, focused ESLint, TypeScript và `git diff --check` PASS. Independent review, PostgreSQL
  concurrent run và full non-browser gates chưa chạy; report ở
  `../reports/10-w2-career-goal-cas/qa-report.json`.
- Playwright/browser/persona vẫn NOT_RUN theo chỉ đạo.

### Remediation review 11:34 ICT

- Reviewer nêu 1 P1 và 2 P2; cả ba đã sửa và đang `FIXED_PENDING_REREVIEW`.
- Recovery 409 nay await deferred refetch trước khi hiện “đã tải lại”; mọi nút có thể mở lại
  snapshot bị khóa khi pending. Refetch failure có thông báo riêng và giữ draft.
- Hai assertion reset dùng regex thật. Test PostgreSQL dùng hai HTTP client, hai DB session và
  barrier ngay trước production UPDATE, kèm timeout; focused SQLite vẫn skip test này.
- Focused sau sửa: frontend 5/5; backend 4 pass/1 skip; Ruff/ESLint/tsc PASS. Chưa commit/push.

## 2026-09-14 12:09 ICT — W2-CAREER-GOAL-CAS: FINAL APPROVE, PASS

- Implementation/test commit: `08b0cd6c6cac1c91f2a9c284a4d00a1fdf8ae9ea`.
- Reviewer độc lập final **APPROVE, 0 P0/P1/P2**; `P1-1`, `P2-1`, `P2-2` đều CLOSED.
- Exact implementation SHA: PostgreSQL focused 4 passed trong 3.64s; backend SQLite full 680
  passed/19 skipped trong 82.42s; Ruff PASS; mypy app PASS trên 90 source files.
- Frontend full: 25 file/177 test; ESLint, TypeScript và Next production build đều PASS; static
  generation 17/17.
- Slice chuyển từ active sang completed PASS; W2 tiếp tục IN_PROGRESS. Browser/Playwright/
  persona/accessibility/performance vẫn NOT_RUN theo chỉ đạo. Docs/ledger chờ docs commit riêng.

## 2026-09-14 12:38 ICT — W2-CAREER-PLAN-SNAPSHOT: PENDING_REVIEW

- Candidate chưa commit trên base `450478b2ce59c3f8bd8ed64a2f4e9488b419f2c4`; task chỉ nằm
  trong `active_assignments`, không nằm trong `completed_slices`.
- Reviewer vòng đầu REQUEST_CHANGES với 0 P0/P1 và 3 P2. Cả ba đã sửa: trạng thái refreshing
  hiển thị ngay khi đang await history refetch; thêm PostgreSQL-only barrier test đi qua production
  `SELECT FOR UPDATE`; ledger/report/handoff được đồng bộ.
- Focused gates sau sửa: frontend 1 file/9 test PASS; backend SQLite 2 pass/1 PostgreSQL-only skip;
  Ruff, ESLint và TypeScript PASS. PostgreSQL local cô lập hiện không chạy nên chưa claim test
  concurrent PASS.
- Chờ independent re-review và full non-browser gates. Browser/Playwright/persona vẫn NOT_RUN;
  file v1 dirty từ trước ngoài phạm vi và không được stage.

## 2026-09-14 12:42 ICT — W2-CAREER-PLAN-SNAPSHOT: FINAL APPROVE, PASS

- Implementation/test commit `528900a9a773d9d0f3533674b8f6cd75eb29b204`; reviewer độc lập
  FINAL APPROVE, 0 P0/P1/P2; cả ba finding P2 vòng đầu đã CLOSED.
- PostgreSQL focused 3 passed trong 2.00s. Backend SQLite full đạt 682 passed/20 skipped
  trong 83.97s; Ruff PASS và mypy app PASS trên 90 source files.
- Frontend full đạt 25 file/181 test; ESLint, TypeScript và Next production build PASS;
  static generation 17/17.
- Slice chuyển khỏi active sang completed PASS; W2 tiếp tục IN_PROGRESS. Report chuẩn:
  `../reports/11-w2-career-plan-snapshot/qa-report.json` và `report.html`.
- Browser/Playwright/persona/accessibility/performance vẫn NOT_RUN theo chỉ đạo. Docs/ledger
  chờ commit tài liệu riêng; file v1 dirty từ trước ngoài phạm vi.

## 2026-09-14 15:06 ICT — W2-AI-ROADMAP-GROUNDING: PENDING_REVIEW

- Candidate chưa commit trên base `3dacef69062425ded6c556c156770b997839f036`; chỉ thay đổi file
  thuộc slice AI roadmap dưới `v2/`. Bốn dirty dashboard file ngoài phạm vi không bị sửa.
- Backend buộc roadmap output đúng schema, có subject/source/evidence UUID trong allowlist và
  evidence ở proposal, từng milestone, từng task. JSON/schema sai, ID bịa, thiếu evidence,
  timeout hoặc empty response đều fail trước persistence.
- Profile context được đóng gói `UNTRUSTED_DATA` và tách khỏi system prompt. Provider prose và
  proposal không được lưu trong assistant history; response tạm được frontend mở trực tiếp trong
  editor và chỉ endpoint save riêng mới persist sau xác nhận.
- Focused gates: backend 18/18 PASS trong 1.55s; Ruff PASS; mypy app 90 files PASS; frontend
  1/1 PASS và focused ESLint PASS. Full `npm run typecheck` bị chặn bởi dirty file ngoài phạm vi
  `tests/live-dashboard.test.tsx:96` dùng `DEPT_LEAD`; task bị cấm sửa file đó.
- Independent review và full non-browser suites chưa chạy. Browser/Playwright/persona vẫn
  `NOT_RUN` theo chỉ đạo. Report nháp: `../reports/12-w2-ai-roadmap-grounding/qa-report.json`.

### Remediation review 2026-09-14 15:19 ICT

- Reviewer trả `REQUEST_CHANGES`: 0 P0, 1 P1, 1 P2. Cả hai finding đã
  `FIXED_PENDING_REREVIEW`; task vẫn `PENDING_REVIEW`.
- P1: proposal đang mở nay khóa textarea, submit, tạo mới và chuyển conversation cho đến khi
  lưu hoặc bỏ. Response proposal mới gọi `save.reset()` trước khi cài proposal/key; editor remount
  theo key mới và discard cũng reset mutation state.
- P2: mock editor expose explicit confirm. Test chứng minh query gọi `saveRoadmap` 0 lần, confirm
  gọi đúng 1 lần; chuỗi A → save A → generate B không mang save-success cũ sang B.
- Focused frontend sau sửa: 2/2 PASS; focused ESLint PASS. Full typecheck vẫn chỉ lỗi dirty
  dashboard test ngoài phạm vi tại `tests/live-dashboard.test.tsx:96`; browser NOT_RUN.

## 2026-09-14 15:52 ICT — W2-AI-ROADMAP-GROUNDING: FINAL APPROVE, PASS

- Implementation SHA `546d5786be900ce003e768ed4602a4015701bb90`; phần AI implementation được
  xác minh không đổi trong integrated verification SHA `c0a1fee65fcc66f3e1e4241252b5b1a7cd4645c4`.
- Reviewer độc lập final **APPROVE, 0 P0/P1/P2**; `P1-1` và `P2-1` CLOSED.
- Exact verification SHA: backend full 694 passed/20 skipped trong 71.47s; Ruff PASS; mypy app
  90 source files PASS. Frontend full 27 files/190 tests trong 10.43s; lint/typecheck PASS;
  production build PASS trong 12.45s với 17/17 routes.
- Slice chuyển khỏi active sang completed PASS; W2 tiếp tục IN_PROGRESS. Report chuẩn:
  `../reports/12-w2-ai-roadmap-grounding/qa-report.json`.
- Browser/Playwright/persona và provider live vẫn NOT_RUN theo chỉ đạo. Evidence token hiện chưa
  phải SourceBlock citation bền vững và allowlist chưa tự đánh giá semantic claim-evidence.
