# Wave 1 — Hồ sơ năng lực cốt lõi và roster theo tenant

- **Mã tính năng:** 02-core-profile-roster
- **Nhánh:** feat/v2-rebuild
- **Implementation SHA:** `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- **Thời điểm tạo:** 2026-09-12T04:01:02.578501Z
- **Kết quả:** **PASS**

## Giá trị sử dụng

Nhân viên cập nhật hồ sơ cơ bản an toàn; HR và quản lý xem đúng đội ngũ của công ty với giao diện rõ ràng mà không làm lộ email, quyền quản trị hoặc dữ liệu tenant khác.

## Phạm vi

- Cung cấp hồ sơ cá nhân có xem, sửa tên/chức danh, phiên bản lạc quan và activity log cùng transaction.
- Cung cấp roster HR/BOD chỉ đọc, tìm tên/chức danh, phân trang server và detail nhân sự trong company scope.
- Cho SUPER_ADMIN chọn tenant rõ ràng; COMPANY_ADMIN không thể ghi đè tenant bằng URL hoặc cache phía trình duyệt.
- Đồng bộ OpenAPI/generated client, migration constraint/index và các trạng thái loading, empty, error, stale.
- Áp dụng CareerMate design system, Milo theo ngữ cảnh, responsive, keyboard, reduced motion và touch target 44px.

## Phân rã chức năng

1. **Nhân viên:** Mở hồ sơ 360 độ, xem timeline và kỹ năng hiện có, chỉnh tên hoặc chức danh rồi lưu bằng profileVersion.
2. **Backend:** Dùng compare-and-swap trên version, ghi activity log trong cùng transaction và trả 409 typed khi bản ghi đã thay đổi.
3. **Company admin hoặc HR:** Xem roster employee, tìm kiếm và chuyển trang; projection chỉ chứa dữ liệu nghề nghiệp tối thiểu.
4. **Super admin:** Chọn một company active trước khi tải roster; scope được giữ khi mở detail và quay lại danh sách.
5. **Frontend:** Khóa cache theo principal và tenant hiệu lực, không reuse dữ liệu khi đổi tenant hoặc đổi phiên trên cùng trình duyệt.
6. **Người dùng bàn phím hoặc reduced motion:** Điều hướng bằng focus rõ, điều khiển tối thiểu 44px và không bị chuyển động dài.

## Tiêu chí nghiệm thu

- **AC-01 · PASS:** Profile update dùng optimistic locking và audit cùng transaction; stale write không ghi đè. (bằng chứng: CHK-INTEGRATION, CHK-SECURITY)
- **AC-02 · PASS:** Roster và detail áp dụng permission cùng tenant scope ở backend, không trả email hoặc quyền quản trị. (bằng chứng: CHK-INTEGRATION, CHK-SECURITY)
- **AC-03 · PASS:** Frontend không reuse cache detail/list giữa principal hoặc tenant và bỏ qua foreign companyId với company admin. (bằng chứng: CHK-UNIT, CHK-E2E)
- **AC-04 · PASS:** Search, pagination, lỗi nghiệp vụ và validation có contract thống nhất giữa API, demo và client. (bằng chứng: CHK-CONTRACT, CHK-UNIT, CHK-INTEGRATION)
- **AC-05 · PASS:** Migration/index và SQLAlchemy metadata không drift. (bằng chứng: CHK-MIGRATION)
- **AC-06 · PASS:** UI profile, roster và detail rõ ràng trên ba viewport, đạt keyboard, axe, reduced motion và touch target. (bằng chứng: CHK-E2E, CHK-ACCESSIBILITY, CHK-MANUAL-UI)
- **AC-07 · PASS:** Format, lint, typecheck, tests và production build đều đạt trên exact SHA. (bằng chứng: CHK-FORMAT, CHK-LINT, CHK-TYPE, CHK-UNIT, CHK-BUILD)
- **AC-08 · PASS:** Không có security critical/high, dependency vulnerability hoặc secret trong committed diff. (bằng chứng: CHK-SECURITY)
- **AC-09 · PASS:** Profile production build giữ LCP dưới 2.5 giây tại ba viewport chuẩn. (bằng chứng: CHK-PERFORMANCE)

## Kiểm thử và bằng chứng

### CHK-FORMAT · PASS

- Loại: FORMAT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff format --check .`
- Thư mục: `v2/backend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Ruff xác nhận 68 file Python đã được format.
- Số liệu: files=68

### CHK-LINT · PASS

- Loại: LINT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff check . và npm run lint`
- Thư mục: `v2`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Backend và frontend không có lint error hoặc warning.
- Số liệu: errors=0, warnings=0

### CHK-TYPE · PASS

- Loại: TYPECHECK
- Bắt buộc: Có
- Lệnh: `.venv/bin/mypy app scripts và npm run typecheck`
- Thư mục: `v2`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Mypy PASS 40 source file và TypeScript PASS 0 lỗi.
- Số liệu: backend_files=40, errors=0

### CHK-UNIT · PASS

- Loại: UNIT
- Bắt buộc: Có
- Lệnh: `npm test`
- Thư mục: `v2/frontend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Vitest PASS 40 test trong 10 suite, gồm cache chéo phiên, tenant override, search parity và touch target contract.
- Artifact: `v2/frontend/tests`
- Số liệu: failed=0, passed=40, suites=10

### CHK-INTEGRATION · PASS

- Loại: INTEGRATION
- Bắt buộc: Có
- Lệnh: `CAREERMATE_TEST_DATABASE_URL=postgresql+asyncpg://[REDACTED]/careermate_v2_test .venv/bin/pytest -q`
- Thư mục: `v2/backend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: 212 backend test PASS trên PostgreSQL riêng; bao phủ quyền, cross-company 404/403, CAS version, transaction rollback, pagination và query validation.
- Artifact: `v2/backend/tests`, `v2/reports/02-core-profile-roster/traces/exact-sha-evidence.json`
- Số liệu: duration_seconds=47.73, failed=0, postgresql_passed=212

### CHK-CONTRACT · PASS

- Loại: CONTRACT
- Bắt buộc: Có
- Lệnh: `python -m scripts.export_openapi --check và npm run contracts:check`
- Thư mục: `v2`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: OpenAPI 3.1 snapshot và generated TypeScript contract hiện tại; business 400 tách khỏi validation 422 và page có maximum 10000.
- Artifact: `v2/contracts/openapi.json`, `v2/contracts/generated/openapi.ts`
- Số liệu: stale_contracts=0

### CHK-MIGRATION · PASS

- Loại: MIGRATION
- Bắt buộc: Có
- Lệnh: `alembic upgrade head và alembic check trên careermate_v2_migration_check`
- Thư mục: `v2/backend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Migration 0007 nâng schema thành công; functional roster index khớp lower(name), id và Alembic không phát hiện drift.
- Artifact: `v2/backend/alembic/versions/0007_core_profile_roster.py`
- Số liệu: drift_operations=0, head_revision=0007_core_profile_roster

### CHK-BUILD · PASS

- Loại: BUILD
- Bắt buộc: Có
- Lệnh: `NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_BUILD_SHA=&lt;exact_sha&gt; npm run build`
- Thư mục: `v2/frontend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Next.js 16.3.5 production build PASS và nhúng đúng implementation SHA.
- Số liệu: errors=0

### CHK-E2E · PASS

- Loại: E2E
- Bắt buộc: Có
- Lệnh: `CAREERMATE_EXPECTED_SHA=&lt;exact_sha&gt; CAREERMATE_E2E_USE_BUILD=true npm run test:e2e`
- Thư mục: `v2/frontend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: 60 Playwright scenario PASS trên production build ở 390x844, 768x1024 và 1440x900, gồm profile, roster, detail, permissions và recovery states.
- Artifact: `v2/frontend/tests/e2e/profile-roster.spec.ts`, `v2/reports/02-core-profile-roster/screenshots/manifest.json`
- Số liệu: failed=0, passed=60, viewports=3

### CHK-ACCESSIBILITY · PASS

- Loại: ACCESSIBILITY
- Bắt buộc: Có
- Lệnh: `npm run test:e2e (axe, keyboard, focus, touch target và reduced motion)`
- Thư mục: `v2/frontend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Axe 0 violation; keyboard focus, reduced motion và vùng chạm tối thiểu 44x44 được kiểm tra trên ba viewport.
- Artifact: `v2/frontend/tests/e2e/profile-roster.spec.ts`
- Số liệu: axe_violations=0, keyboard=True, reduced_motion=True, touch_target_px=44, viewports=3

### CHK-SECURITY · PASS

- Loại: SECURITY
- Bắt buộc: Có
- Lệnh: `bandit -ll; pip-audit; npm audit --omit=dev; gitleaks git origin/master..HEAD`
- Thư mục: `v2`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Bandit có 0 medium/high; Python và npm production có 0 vulnerability; Gitleaks quét committed diff và không phát hiện secret.
- Artifact: `v2/backend/app/services/profile_service.py`, `v2/frontend/tests/profile-roster.test.tsx`
- Số liệu: bandit_medium_high=0, critical_high=0, dependency_vulnerabilities=0, gitleaks_findings=0

### CHK-PERFORMANCE · PASS

- Loại: PERFORMANCE
- Bắt buộc: Có
- Lệnh: `npm run test:e2e (profile LCP budget)`
- Thư mục: `v2/frontend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Trang hồ sơ trên production build đạt ngân sách LCP dưới 2500 ms trong cả ba viewport kiểm tra.
- Artifact: `v2/frontend/tests/e2e/profile-roster.spec.ts`
- Số liệu: budget_ms=2500, scenarios_under_budget=3

### CHK-MANUAL-UI · PASS

- Loại: MANUAL_UI
- Bắt buộc: Có
- Lệnh: `Independent exact-SHA persona review và đối chiếu 8 ảnh production/checksum`
- Thư mục: `v2/frontend`
- SHA: `ca230bceb3b2d9be473fa8f842b23ecd51379115`
- Kết quả: Independent review xác nhận profile/roster/detail rõ ràng, responsive, một nút xóa tìm kiếm, Milo đúng ngữ cảnh và không còn P0/P1/P2 UI.
- Artifact: `v2/reports/02-core-profile-roster/screenshots`, `v2/reports/02-core-profile-roster/screenshots/manifest.json`
- Số liệu: checksum_mismatches=0, open_p0=0, open_p1=0, open_p2_ui=0, personas_passed=5, screenshots=8

## Review UI/UX theo persona

### EMPLOYEE_22_30 · 390x844 · PASS

- **P2:** Hành động hồ sơ cần rõ trên màn hình hẹp. → Hai CTA được xếp dọc, giữ nhãn đầy đủ và Milo đặt sau nội dung chính.

### HR_35_45 · 1440x900 · PASS

- **P1:** Cache detail từng có thể gắn dữ liệu tenant cũ vào tenant mới trên trình duyệt dùng chung. → Cache key nay chứa principal và tenant hiệu lực; regression A sang B xác nhận dữ liệu cũ không xuất hiện.

### MANAGER_45_55 · 1440x900 · PASS

- **P2:** Roster cần ưu tiên tên, chức danh và phòng ban để quét nhanh. → Card giữ thứ bậc rõ, action chỉ đọc duy nhất và khoảng trắng ổn định.

### LOW_TECH_USER · 768x1024 · PASS

- **P2:** Nút xóa tìm kiếm 40px và native Chromium X từng gây khó hiểu. → Giữ một nút tùy biến 44x44, nhãn truy cập rõ và bàn phím tìm kiếm trên mobile.

## API, schema và giao diện thay đổi

- API · GET/PATCH /api/v2/profile/me: Thêm self profile read/update với optimistic version và typed 409 conflict.
- API · GET /api/v2/people và /people/{employeeId}: Thêm roster/detail theo company scope, server search và pagination.
- API · GET /api/v2/companies/options: Thêm company selector chỉ cho quyền platform:manage.
- DATABASE · User.version và ix_users_roster_scope: Thêm invariant version dương và index theo company, role, lower(name), id.
- UI_ROUTE · /ho-so, /nhan-su và /nhan-su/:employeeId: Thêm profile editor, roster và read-only person detail responsive.

## Bảo mật và quyền riêng tư

- Backend bắt buộc people:read và company scope; cross-tenant detail trả 404, foreign tenant list trả 403.
- Roster projection không trả email, password hash, token hoặc admin permissions.
- Query cache list/detail chứa principal và tenant hiệu lực để ngăn dữ liệu riêng tư sống qua phiên khác.
- Profile compare-and-swap và activity log commit hoặc rollback cùng nhau; log chỉ chứa tên trường và version.
- Report, screenshot và committed diff chỉ dùng dữ liệu demo, không chứa secret hoặc dữ liệu nhân sự thật.

## AI và kiểm soát nguồn

- Không có.

## Ảnh kiểm chứng

- /ho-so · 390x844 · v2/reports/02-core-profile-roster/screenshots/profile-390x844.png · SHA ca230bceb3b2d9be473fa8f842b23ecd51379115
- /ho-so · 768x1024 · v2/reports/02-core-profile-roster/screenshots/profile-768x1024.png · SHA ca230bceb3b2d9be473fa8f842b23ecd51379115
- /ho-so · 1440x900 · v2/reports/02-core-profile-roster/screenshots/profile-1440x900.png · SHA ca230bceb3b2d9be473fa8f842b23ecd51379115
- /nhan-su · 390x844 · v2/reports/02-core-profile-roster/screenshots/roster-390x844.png · SHA ca230bceb3b2d9be473fa8f842b23ecd51379115
- /nhan-su · 768x1024 · v2/reports/02-core-profile-roster/screenshots/roster-768x1024.png · SHA ca230bceb3b2d9be473fa8f842b23ecd51379115
- /nhan-su · 1440x900 · v2/reports/02-core-profile-roster/screenshots/roster-1440x900.png · SHA ca230bceb3b2d9be473fa8f842b23ecd51379115
- /nhan-su · 1440x900 · v2/reports/02-core-profile-roster/screenshots/roster-super-admin-1440x900.png · SHA ca230bceb3b2d9be473fa8f842b23ecd51379115
- /nhan-su/demo-employee · 1440x900 · v2/reports/02-core-profile-roster/screenshots/person-detail-1440x900.png · SHA ca230bceb3b2d9be473fa8f842b23ecd51379115

## Giới hạn và việc tiếp theo

- Kỹ năng, kinh nghiệm, dự án, chứng chỉ, giải thưởng và aggregate timeline hiện mới đọc dữ liệu sẵn có; CRUD resource đầy đủ thuộc slice tiếp theo. (ảnh hưởng: HIGH) → Triển khai profile resource aggregate và provenance trong Wave 1 kế tiếp; giữ toàn Wave 1 ở IN_PROGRESS.
- Company options cho SUPER_ADMIN chưa có search/phân trang và hiện tải toàn bộ company active. (ảnh hưởng: MEDIUM) → Thêm combobox server search và pagination trước khi dùng với dữ liệu platform lớn.
- E2E và screenshot dùng deterministic demo fixture; live API wiring có unit test nhưng chưa có browser E2E với backend thật. (ảnh hưởng: MEDIUM) → Thêm full-stack browser lane sau khi resource aggregate ổn định.
- Chưa có load benchmark p95 cho non-AI API trên demo dataset. (ảnh hưởng: MEDIUM) → Đo và lưu trace p95 trong Wave 6 hardening.

## Môi trường đã che thông tin nhạy cảm

- ai_provider: None
- browser: Chromium qua Playwright 1.63.0
- database: PostgreSQL local: careermate_v2_test và careermate_v2_migration_check
- node: v26.7.0
- os: macOS Darwin arm64
- python: 3.12.8
