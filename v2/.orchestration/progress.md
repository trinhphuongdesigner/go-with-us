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
