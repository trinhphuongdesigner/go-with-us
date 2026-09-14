# W3 — Vòng đời mẫu và chu kỳ đánh giá có phiên bản

- **Mã tính năng:** 16-w3-assessment-template-cycle-lifecycle
- **Nhánh:** codex/v2-qa-consolidation
- **Implementation SHA:** `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- **Thời điểm tạo:** 2026-09-14T21:41:19+07:00
- **Kết quả:** **BLOCKED**

## Giá trị sử dụng

HR có thể quản lý mẫu và chu kỳ đánh giá theo trạng thái rõ ràng, giữ lịch sử đúng revision và nhận conflict có cấu trúc khi hai người cập nhật đồng thời, tránh ghi đè âm thầm hoặc tạo audit lệch dữ liệu.

## Phạm vi

- Template create, publish, archive, revise và delete theo state machine có tenant/permission guard.
- Tách content version khỏi optimistic rowVersion bằng migration Alembic 0019.
- Giữ revision template cũ bất biến khi đã được cycle tham chiếu; delete chuyển soft-archive khi cần.
- Cycle chỉ tạo từ template ACTIVE cùng tenant; close/reopen dùng expectedVersion và typed 409.
- Ghi metadata-only activity log cùng transaction và rollback khi audit lỗi.
- Đồng bộ frontend, OpenAPI và generated TypeScript contract cho expectedRowVersion.

## Phân rã chức năng

1. **HR hoặc Company Admin:** Tạo template ở trạng thái DRAFT với content version 1 và rowVersion 1 trong đúng tenant.
2. **HR hoặc Company Admin:** Publish hoặc archive template bằng expectedRowVersion; stale row và state không hợp lệ trả typed 409.
3. **Assessment service:** Khi sửa nội dung, archive revision cũ và tạo DRAFT revision mới cùng family, giữ cycle cũ trỏ đúng revision ban đầu.
4. **HR hoặc Company Admin:** Tạo cycle chỉ từ template ACTIVE cùng tenant; close/reopen bằng expectedVersion.
5. **Transaction boundary:** Ghi mutation và metadata-only activity log nguyên tử; audit exception rollback toàn bộ thay đổi.
6. **Frontend:** Hiển thị content revision nhưng gửi rowVersion cho template mutation và hiển thị conflict từ backend.

## Tiêu chí nghiệm thu

- **AC-01 · PASS:** Template publish/archive/revise/delete tuân thủ state machine và typed conflict. (bằng chứng: CHK-INTEGRATION-SQLITE, CHK-INTEGRATION-POSTGRESQL)
- **AC-02 · PASS:** Content version tách khỏi rowVersion; revise giữ cycle identity theo revision cũ. (bằng chứng: CHK-INTEGRATION-SQLITE, CHK-MIGRATION)
- **AC-03 · PASS:** Cycle chỉ dùng template ACTIVE cùng tenant và close/reopen có optimistic locking. (bằng chứng: CHK-INTEGRATION-POSTGRESQL)
- **AC-04 · PASS:** Mutation và metadata-only audit nguyên tử; audit lỗi rollback. (bằng chứng: CHK-INTEGRATION-SQLITE, CHK-INTEGRATION-POSTGRESQL)
- **AC-05 · PASS:** Frontend, OpenAPI và generated client dùng expectedRowVersion đúng nghĩa. (bằng chứng: CHK-UNIT, CHK-CONTRACT, CHK-TYPECHECK, CHK-BUILD)
- **AC-06 · PASS:** Code slice đạt independent review với 0 P0/P1/P2 và static gates thuộc phạm vi. (bằng chứng: CHK-REVIEW, CHK-FORMAT-OWNED, CHK-LINT, CHK-TYPECHECK)
- **AC-07 · NOT_RUN:** Browser E2E, accessibility, performance và manual persona review có evidence trên exact SHA. (bằng chứng: CHK-E2E, CHK-ACCESSIBILITY, CHK-PERFORMANCE, CHK-MANUAL-UI)
- **AC-08 · BLOCKED:** Whole-backend Ruff format gate đạt trên toàn bộ repository. (bằng chứng: CHK-FORMAT-FULL)

## Kiểm thử và bằng chứng

### CHK-FORMAT-OWNED · PASS

- Loại: FORMAT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff format --check &lt;task-owned Python files&gt;`
- Thư mục: `v2/backend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Các file Python thuộc slice đạt targeted Ruff format check.
- Artifact: `v2/backend/alembic/versions/0019_template_row_version.py`, `v2/backend/app/assessments`
- Số liệu: owned_files_pass=True

### CHK-FORMAT-FULL · BLOCKED

- Loại: FORMAT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff format --check .`
- Thư mục: `v2/backend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Whole-backend format gate phát hiện 8 file pre-existing/out-of-scope chưa format; file thuộc slice vẫn PASS.
- Số liệu: out_of_scope_unformatted_files=8
- Blocker: Tám file tồn tại từ trước nằm ngoài phạm vi slice và chưa được phép sửa rộng.
- Cách chạy lại: Tạo task hygiene riêng, format tám file ngoài phạm vi rồi chạy lại .venv/bin/ruff format --check .

### CHK-LINT · PASS

- Loại: LINT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff check . && npm run lint`
- Thư mục: `v2`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Ruff lint toàn backend và ESLint frontend đều PASS.
- Số liệu: lint_errors=0

### CHK-TYPECHECK · PASS

- Loại: TYPECHECK
- Bắt buộc: Có
- Lệnh: `.venv/bin/mypy app && npm run typecheck`
- Thư mục: `v2`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Mypy PASS trên 97 source files; TypeScript typecheck PASS.
- Số liệu: python_source_files=97, typescript_errors=0

### CHK-UNIT · PASS

- Loại: UNIT
- Bắt buộc: Có
- Lệnh: `npm test`
- Thư mục: `v2/frontend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Frontend full suite PASS: 29 files, 194 tests; focused lifecycle suite PASS: 2 files, 4 tests.
- Artifact: `v2/frontend/tests/template-lifecycle-version.test.tsx`, `v2/frontend/tests/assessment-review.test.tsx`
- Số liệu: focused_files=2, focused_passed=4, full_files=29, full_passed=194

### CHK-INTEGRATION-SQLITE · PASS

- Loại: INTEGRATION
- Bắt buộc: Có
- Lệnh: `CAREERMATE_DEMO_LOGIN_ENABLED=false .venv/bin/pytest -q`
- Thư mục: `v2/backend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Backend full suite PASS: 743 passed, 23 skipped; focused SQLite lifecycle: 15 passed, 2 skipped.
- Artifact: `v2/backend/tests/test_assessment_template_cycle_lifecycle.py`, `v2/backend/tests/test_migration_contract.py`
- Số liệu: focused_passed=15, focused_skipped=2, full_passed=743, full_skipped=23

### CHK-INTEGRATION-POSTGRESQL · PASS

- Loại: INTEGRATION
- Bắt buộc: Có
- Lệnh: `CAREERMATE_TEST_DATABASE_URL=&lt;redacted PostgreSQL URL&gt; .venv/bin/pytest -q tests/test_assessment_template_cycle_lifecycle.py`
- Thư mục: `v2/backend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: PostgreSQL lifecycle suite PASS: 16 tests, gồm concurrent cycle close và template edit chỉ một winner.
- Artifact: `v2/backend/tests/test_assessment_template_cycle_lifecycle.py`
- Số liệu: concurrency_one_winner=True, failed=0, passed=16

### CHK-CONTRACT · PASS

- Loại: CONTRACT
- Bắt buộc: Có
- Lệnh: `npm run contracts:check`
- Thư mục: `v2/frontend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: OpenAPI snapshot và generated TypeScript client đồng bộ rowVersion/expectedRowVersion; contract check PASS.
- Artifact: `v2/contracts/openapi.json`, `v2/contracts/generated`
- Số liệu: drift=False

### CHK-MIGRATION · PASS

- Loại: MIGRATION
- Bắt buộc: Có
- Lệnh: `alembic current && alembic check`
- Thư mục: `v2/backend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Alembic 0019_template_row_version là head và không có schema drift.
- Artifact: `v2/backend/alembic/versions/0019_template_row_version.py`
- Số liệu: drift=False, head=0019_template_row_version

### CHK-BUILD · PASS

- Loại: BUILD
- Bắt buộc: Có
- Lệnh: `npm run build`
- Thư mục: `v2/frontend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Next.js production build PASS với 17/17 routes.
- Số liệu: routes=17

### CHK-REVIEW · PASS

- Loại: SECURITY
- Bắt buộc: Không
- Lệnh: `Independent read-only review on exact implementation SHA`
- Thư mục: `v2`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Independent final review APPROVE, 0 P0/P1/P2 cho diff của slice.
- Artifact: `v2/reports/16-w3-assessment-template-cycle-lifecycle/qa-report.json`
- Số liệu: p0=0, p1=0, p2=0

### CHK-E2E · NOT_RUN

- Loại: E2E
- Bắt buộc: Có
- Lệnh: `npm run test:e2e -- assessment-template-cycle`
- Thư mục: `v2/frontend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Playwright lifecycle flow chưa chạy theo yêu cầu hiện tại.
- Blocker: Browser automation đang được user tạm dừng.
- Cách chạy lại: Khi user bật lại browser gate, chạy lifecycle flow trên các viewport mục tiêu và lưu trace/screenshot.

### CHK-ACCESSIBILITY · NOT_RUN

- Loại: ACCESSIBILITY
- Bắt buộc: Có
- Lệnh: `npm run test:e2e -- assessment-template-cycle (axe/keyboard/reduced-motion)`
- Thư mục: `v2/frontend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Axe, keyboard-only, focus visibility và reduced motion chưa có evidence cho slice.
- Blocker: Browser accessibility review đang được user tạm dừng.
- Cách chạy lại: Chạy axe và keyboard/reduced-motion checks cùng Playwright khi browser gate được bật lại.

### CHK-SECURITY · NOT_RUN

- Loại: SECURITY
- Bắt buộc: Có
- Lệnh: `bandit -ll; pip-audit; npm audit --omit=dev; gitleaks`
- Thư mục: `v2`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Security và dependency scan riêng cho exact SHA chưa chạy trong slice này.
- Blocker: Slice chỉ được yêu cầu chạy functional/static gates; security scan được deferred.
- Cách chạy lại: Chạy security/dependency/secret scan trên exact SHA trước release gate.

### CHK-PERFORMANCE · NOT_RUN

- Loại: PERFORMANCE
- Bắt buộc: Có
- Lệnh: `npm run test:e2e -- assessment-template-cycle (performance budget)`
- Thư mục: `v2/frontend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Chưa đo browser timing hoặc LCP cho màn hình assessment lifecycle.
- Blocker: Browser/performance gate đang được user tạm dừng.
- Cách chạy lại: Đo LCP và response timing trên production build khi browser gate được bật lại.

### CHK-MANUAL-UI · NOT_RUN

- Loại: MANUAL_UI
- Bắt buộc: Có
- Lệnh: `Manual UI review với bốn persona bắt buộc`
- Thư mục: `v2/frontend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Manual UI/persona review chưa chạy trong slice.
- Blocker: Manual/browser review đang được user tạm dừng.
- Cách chạy lại: Tester kiểm tra lifecycle actions, conflict copy và focus trên bốn persona/viewport.

### CHK-PROVIDER · NOT_RUN

- Loại: AI_GROUNDING
- Bắt buộc: Không
- Lệnh: `Live AI provider smoke test`
- Thư mục: `v2/backend`
- SHA: `c0592e8b0e17d9fb1ab21fb17c680a5f6f19b86f`
- Kết quả: Provider live không được gọi; AI không tham gia state transition hay tính điểm trong slice.
- Blocker: Provider live nằm ngoài phạm vi deterministic template/cycle lifecycle.
- Cách chạy lại: Chỉ chạy provider smoke trong slice AI liên quan với dữ liệu giả lập và secret đã che.

## Review UI/UX theo persona

### EMPLOYEE_22_30 · 390x844 · NOT_RUN

- Không còn finding mở trong phạm vi review.

### HR_35_45 · 1440x900 · NOT_RUN

- Không còn finding mở trong phạm vi review.

### MANAGER_45_55 · 1440x900 · NOT_RUN

- Không còn finding mở trong phạm vi review.

### LOW_TECH_USER · 768x1024 · NOT_RUN

- Không còn finding mở trong phạm vi review.

## API, schema và giao diện thay đổi

- API · Assessment template lifecycle endpoints: Publish/archive/edit/delete nhận expectedRowVersion và trả typed version_conflict hoặc invalid_state.
- API · Assessment cycle lifecycle endpoints: Create yêu cầu ACTIVE same-tenant template; close/reopen nhận expectedVersion.
- DATABASE · assessment_templates.row_version: Migration 0019 thêm row_version NOT NULL mặc định 1 và check row_version &gt;= 1.
- UI_ROUTE · Assessment template management: UI hiển thị content revision và gửi đúng optimistic rowVersion cho lifecycle action.

## Bảo mật và quyền riêng tư

- Tenant và permission guard được bao phủ trong lifecycle integration tests.
- Activity log chỉ chứa status, version và ID liên quan; không ghi nội dung template riêng tư.
- Security/dependency/secret scan riêng cho exact SHA chưa chạy nên report tổng thể giữ BLOCKED.

## AI và kiểm soát nguồn

- Không có.

## Ảnh kiểm chứng

- Không có.

## Giới hạn và việc tiếp theo

- Browser E2E, accessibility, performance và bốn persona review chưa chạy. (ảnh hưởng: HIGH) → Chạy lại các gate browser trên exact implementation SHA khi user cho phép.
- Security/dependency/secret scan riêng cho slice chưa chạy. (ảnh hưởng: HIGH) → Chạy Bandit, dependency audit và secret scan trên exact SHA trước release gate.
- Whole-backend Ruff format còn 8 file pre-existing/out-of-scope chưa format. (ảnh hưởng: LOW) → Xử lý trong task hygiene riêng rồi chạy lại whole-backend format gate.
- Assignment lifecycle và các assessment task khác chưa hoàn tất. (ảnh hưởng: HIGH) → Giữ W3 ở IN_PROGRESS và triển khai assignment lifecycle trong slice riêng.
- Provider live chưa chạy và không liên quan tới state machine deterministic của slice. (ảnh hưởng: LOW) → Chỉ kiểm tra provider trong feature AI liên quan, không dùng AI cho transition hoặc scoring.

## Môi trường đã che thông tin nhạy cảm

- ai_provider: None
- browser: NOT_RUN theo yêu cầu user
- database: SQLite in-memory và PostgreSQL test đã che connection string
- node: Node.js, phiên bản không được ghi trong evidence slice
- os: macOS Darwin arm64
- python: Python 3.12
