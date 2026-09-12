# Wave 0 — Foundation, xác thực, AI boundary và Milo application shell

- **Mã tính năng:** 00-foundation
- **Nhánh:** feat/v2-rebuild
- **Implementation SHA:** `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- **Thời điểm tạo:** 2026-09-11T23:00:25Z
- **Kết quả:** **PASS**

## Giá trị sử dụng

Wave 0 tạo nền móng có thể kiểm chứng để các wave nghiệp vụ dùng chung auth, tenant boundary, AI reliability contract, design system và QA mà không phụ thuộc NestJS hoặc MUI.

## Phạm vi

- FastAPI, Pydantic v2, SQLAlchemy async, Alembic và PostgreSQL cho /api/v2.
- Next.js 16, React 19, Tailwind CSS 4 và application shell theo design system CareerMate.
- Auth, ba role, permission backend, session thu hồi được, tenant isolation và activity log.
- AI gateway typed, evidence boundary, provider encryption, retry/circuit breaker và golden declaration runner.
- Milo roadmap shell responsive, keyboard, reduced motion và bản nháp tách theo tenant/người dùng.
- OpenAPI snapshot, generated TypeScript client, CI và quality gate fail-closed.

## Phân rã chức năng

1. **Người dùng:** Đăng nhập, đọc session hiện tại và đăng xuất để thu hồi session.
2. **Backend:** Xác thực role, permission và company scope trước khi trả dữ liệu; ghi activity log.
3. **Frontend:** Hiển thị navigation theo permission và chặn route trực tiếp bằng màn hình 403.
4. **Nhân viên:** Xem Milo roadmap, sắp xếp bằng nút hoặc bàn phím và lưu bản nháp tách theo company/user.
5. **AI service:** Chỉ trả kết quả đúng schema cùng evidence và trace metadata; không tự ghi database.
6. **Kỹ sư và reviewer:** Chạy contract, migration, unit, integration, E2E, axe, security và performance trên đúng SHA.

## Tiêu chí nghiệm thu

- **AC-01 · PASS:** Backend đúng format, lint, type và chạy trên PostgreSQL test riêng. (bằng chứng: CHK-FORMAT, CHK-LINT, CHK-TYPE, CHK-INTEGRATION)
- **AC-02 · PASS:** Auth, permission, tenant isolation, rollback và test DB safety được kiểm thử. (bằng chứng: CHK-INTEGRATION, CHK-SECURITY)
- **AC-03 · PASS:** Alembic upgrade thành công và không có schema drift. (bằng chứng: CHK-MIGRATION)
- **AC-04 · PASS:** OpenAPI snapshot và generated TypeScript client khớp implementation. (bằng chứng: CHK-CONTRACT)
- **AC-05 · PASS:** Frontend unit test và production build đạt. (bằng chứng: CHK-UNIT, CHK-BUILD)
- **AC-06 · PASS:** Milo shell và roadmap đạt E2E, keyboard, focus, reduced motion và axe trên ba viewport. (bằng chứng: CHK-E2E, CHK-ACCESSIBILITY, CHK-MANUAL-UI)
- **AC-07 · PASS:** LCP dưới 2.5 giây trên ba viewport chuẩn. (bằng chứng: CHK-PERFORMANCE)
- **AC-08 · PASS:** AI foundation kiểm tra schema/evidence/ID; declaration không bị diễn giải thành provider behavior PASS. (bằng chứng: CHK-AI-GROUNDING, CHK-INTEGRATION)
- **AC-09 · PASS:** Không có security critical/high và không có secret trong diff. (bằng chứng: CHK-SECURITY)

## Kiểm thử và bằng chứng

### CHK-FORMAT · PASS

- Loại: FORMAT
- Bắt buộc: Có
- Lệnh: `./v2/scripts/check.sh (ruff format --check .)`
- Thư mục: `v2/backend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Ruff xác nhận 49 file đã được format.
- Số liệu: files=49

### CHK-LINT · PASS

- Loại: LINT
- Bắt buộc: Có
- Lệnh: `./v2/scripts/check.sh (ruff check . và npm run lint)`
- Thư mục: `v2`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Backend và frontend không có lint error hoặc warning.
- Số liệu: errors=0, warnings=0

### CHK-TYPE · PASS

- Loại: TYPECHECK
- Bắt buộc: Có
- Lệnh: `./v2/scripts/check.sh (mypy app scripts và npm run typecheck)`
- Thư mục: `v2`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Mypy PASS 28 file và TypeScript PASS 0 lỗi.
- Số liệu: backend_files=28, errors=0

### CHK-UNIT · PASS

- Loại: UNIT
- Bắt buộc: Có
- Lệnh: `./v2/scripts/check.sh (npm run test)`
- Thư mục: `v2/frontend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Vitest PASS 12 test trong 5 suite.
- Artifact: `v2/frontend/tests`
- Số liệu: passed=12, suites=5

### CHK-INTEGRATION · PASS

- Loại: INTEGRATION
- Bắt buộc: Có
- Lệnh: `./v2/scripts/check.sh (pytest trên careermate_v2_test)`
- Thư mục: `v2/backend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: 111 backend test PASS trên PostgreSQL, gồm auth, tenant, AI, crypto, rate limit, rollback và DB guard.
- Artifact: `v2/backend/tests`
- Số liệu: duration_seconds=27.47, failed=0, passed=111

### CHK-CONTRACT · PASS

- Loại: CONTRACT
- Bắt buộc: Có
- Lệnh: `./v2/scripts/check.sh (export_openapi.py và check-openapi-contract.sh)`
- Thư mục: `v2`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: OpenAPI 3.1 snapshot và TypeScript client không stale.
- Artifact: `v2/contracts/openapi.json`, `v2/contracts/generated/openapi.ts`
- Số liệu: stale_contracts=0

### CHK-MIGRATION · PASS

- Loại: MIGRATION
- Bắt buộc: Có
- Lệnh: `./v2/scripts/check.sh (alembic upgrade head và alembic check)`
- Thư mục: `v2/backend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: 5 migration nâng schema thành công; Alembic không phát hiện drift.
- Artifact: `v2/backend/alembic/versions`
- Số liệu: drift_operations=0, migrations=5

### CHK-BUILD · PASS

- Loại: BUILD
- Bắt buộc: Có
- Lệnh: `./v2/scripts/check.sh (NEXT_PUBLIC_BUILD_SHA=&lt;exact_sha&gt; npm run build)`
- Thư mục: `v2/frontend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Next.js 16.3.5 production build PASS và nhúng đúng SHA.
- Số liệu: errors=0

### CHK-E2E · PASS

- Loại: E2E
- Bắt buộc: Có
- Lệnh: `CAREERMATE_EXPECTED_SHA=&lt;exact_sha&gt; CAREERMATE_E2E_USE_BUILD=true npm run test:e2e`
- Thư mục: `v2/frontend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: 27 Playwright scenario PASS trên production build ở mobile, tablet và desktop.
- Artifact: `v2/frontend/tests/e2e/foundation.spec.ts`
- Số liệu: failed=0, passed=27, viewports=3

### CHK-ACCESSIBILITY · PASS

- Loại: ACCESSIBILITY
- Bắt buộc: Có
- Lệnh: `CAREERMATE_E2E_USE_BUILD=true npm run test:e2e (axe, keyboard, focus, reduced motion)`
- Thư mục: `v2/frontend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Axe 0 violation; dialog giữ focus, Escape đóng, roadmap có phím thay thế drag và reduced motion.
- Artifact: `v2/frontend/tests/e2e/foundation.spec.ts`
- Số liệu: axe_violations=0, viewports=3

### CHK-SECURITY · PASS

- Loại: SECURITY
- Bắt buộc: Có
- Lệnh: `Codex Security exact-head scan; bandit -ll; pip-audit; npm audit --omit=dev; gitleaks`
- Thư mục: `v2`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Exact-head scan COMPLETE với 0 finding; dependency audits sạch và Gitleaks không phát hiện secret.
- Artifact: `/private/var/folders/g9/ky9klfqn7tl49979y5hdflr00000gq/T/codex-security-scans-X0Ia80/v2-integration/01e1e87838d9cd4473a0e661b6dd75291b5119e6_20260911T225320Z_hqtf3ffp/report.md`
- Số liệu: findings=0, inventory_covered=80, inventory_total=80, scan_id=20cf79c3-cc35-4b26-b99b-06dd7e616c33

### CHK-PERFORMANCE · PASS

- Loại: PERFORMANCE
- Bắt buộc: Có
- Lệnh: `CAREERMATE_E2E_USE_BUILD=true npm run test:e2e (LCP budget)`
- Thư mục: `v2/frontend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: LCP dashboard production đều dưới ngân sách 2500 ms.
- Artifact: `v2/frontend/tests/e2e/foundation.spec.ts`
- Số liệu: budget_ms=2500, desktop_lcp_ms=770, mobile_lcp_ms=727, tablet_lcp_ms=703

### CHK-AI-GROUNDING · PASS

- Loại: AI_GROUNDING
- Bắt buộc: Có
- Lệnh: `./.venv/bin/python -m pytest tests/test_ai_golden_runner.py -q`
- Thư mục: `v2/backend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Runner và 33 declaration hợp lệ; provider chưa chạy nên không tuyên bố behavioral PASS.
- Artifact: `v2/contracts/ai-golden-evals.yaml`
- Số liệu: behavioral_pass=0, declarations=33, not_run=33

### CHK-MANUAL-UI · PASS

- Loại: MANUAL_UI
- Bắt buộc: Có
- Lệnh: `Antigravity persona review và đối chiếu ảnh production exact SHA`
- Thư mục: `v2/frontend`
- SHA: `01e1e87838d9cd4473a0e661b6dd75291b5119e6`
- Kết quả: Antigravity correction xác nhận P0/P1 mở bằng 0 và 5 persona PASS; 8 ảnh production không có dev toolbar.
- Artifact: `v2/reports/00-foundation/screenshots`
- Số liệu: open_p0=0, open_p1=0, open_p2=3, personas_passed=5, screenshots=8

## Review UI/UX theo persona

### EMPLOYEE_22_30 · 390x844 · PASS

- **P2:** Chấm thông báo hiện là trạng thái tĩnh trong shell demo. → Chỉ thêm pulse nhẹ khi backend có notification thật.

### HR_35_45 · 768x1024 · PASS

- **P2:** Microcopy empty state cần cập nhật khi Hồ sơ 360 và assessment có dữ liệu thật. → Đưa vào acceptance UI của Wave 1 và Wave 3.

### MANAGER_45_55 · 1440x900 · PASS

- Không còn finding mở trong phạm vi review.

### LOW_TECH_USER · 768x1024 · PASS

- **P2:** Layout dưới 360px chưa có metric grid 2x2 riêng. → Bổ sung khi mở rộng browser matrix; phạm vi nhỏ nhất hiện là 390px và đã PASS.

## API, schema và giao diện thay đổi

- API · POST /api/v2/auth/login, POST /api/v2/auth/logout, GET /api/v2/auth/me: Thêm auth API với session revoke, rate limit chia sẻ và response không lộ secret.
- API · GET /api/v2/health và GET /api/v2/dashboard: Thêm health; dashboard demo có hợp đồng rõ, non-demo trả 501 đến Wave 5.
- DATABASE · Company, User, Employment, AuthSession, ActivityLog, LoginRateLimit: Tạo 5 migration nền tảng với tenant keys, session revoke, actor/timestamp và rate-limit state.
- AI_SCHEMA · AiGateway.generate: Thêm result envelope typed, allowlisted IDs, evidence coverage, retry, circuit breaker và fallback có nhãn.
- UI_ROUTE · /login, /dashboard, /lo-trinh và route 403: Thêm responsive Milo shell, permission-aware navigation, dialogs và roadmap draft editor.

## Bảo mật và quyền riêng tư

- Security scan 20cf79c3-cc35-4b26-b99b-06dd7e616c33 bao phủ 80/80 inventory, 0 finding.
- Test fixture chỉ cho phép SQLite in-memory hoặc PostgreSQL asyncpg loopback với database careermate_v2_test; query override bị từ chối.
- Gitleaks không phát hiện secret; report không chứa credential, connection string hoặc dữ liệu nhân sự thật.
- Provider configuration dùng AES-256-GCM có context binding; ciphertext v1 chỉ đọc khi có context MAC hợp lệ.
- Telemetry contract không ghi raw CV, prompt PII hoặc tên nhân viên.

## AI và kiểm soát nguồn

- AiGateway kiểm tra JSON schema, semantic constraints, allowlisted IDs, tenant scope và evidence coverage.
- 33 golden declaration hợp lệ về cấu trúc; provider không được gọi, behavioral_pass=0 và NOT_RUN=33.
- Deterministic fixture có nhãn, proposal không tự persist và AI layer không ghi database.
- Tên provider/model thật chưa được ghi vì chưa có metadata runtime đã xác minh.

## Ảnh kiểm chứng

- /login · 1440x900 · v2/reports/00-foundation/screenshots/login-1440x900.png · SHA 01e1e87838d9cd4473a0e661b6dd75291b5119e6
- /dashboard · 1440x900 · v2/reports/00-foundation/screenshots/dashboard-1440x900.png · SHA 01e1e87838d9cd4473a0e661b6dd75291b5119e6
- /lo-trinh · 1440x900 · v2/reports/00-foundation/screenshots/roadmap-1440x900.png · SHA 01e1e87838d9cd4473a0e661b6dd75291b5119e6
- /he-thong với role EMPLOYEE · 1440x900 · v2/reports/00-foundation/screenshots/denied-1440x900.png · SHA 01e1e87838d9cd4473a0e661b6dd75291b5119e6
- /dashboard · 768x1024 · v2/reports/00-foundation/screenshots/dashboard-768x1024.png · SHA 01e1e87838d9cd4473a0e661b6dd75291b5119e6
- /lo-trinh · 768x1024 · v2/reports/00-foundation/screenshots/roadmap-768x1024.png · SHA 01e1e87838d9cd4473a0e661b6dd75291b5119e6
- /dashboard · 390x844 · v2/reports/00-foundation/screenshots/dashboard-390x844.png · SHA 01e1e87838d9cd4473a0e661b6dd75291b5119e6
- /lo-trinh · 390x844 · v2/reports/00-foundation/screenshots/roadmap-390x844.png · SHA 01e1e87838d9cd4473a0e661b6dd75291b5119e6

## Giới hạn và việc tiếp theo

- Dashboard non-demo chưa có dữ liệu nghiệp vụ và trả 501 theo hợp đồng. (ảnh hưởng: MEDIUM) → Triển khai dashboard theo role ở Wave 5.
- Roadmap hiện là shell/local draft; chưa có version lock, transaction hoặc AI mind map thật. (ảnh hưởng: MEDIUM) → Triển khai persistence và proposal flow ở Wave 2.
- Employee 360, import và selective apply chưa thuộc Wave 0. (ảnh hưởng: HIGH) → Contract freeze rồi triển khai Wave 1.
- 33 AI golden case mới kiểm tra declaration; provider behavior chưa chạy. (ảnh hưởng: MEDIUM) → Chạy evaluation khi provider metadata và synthetic key được xác minh.
- Ciphertext provider legacy cần context MAC trước khi chuyển read path. (ảnh hưởng: MEDIUM) → Migration dry-run và reconciliation ở Wave 6, không in secret.

## Môi trường đã che thông tin nhạy cảm

- ai_provider: None
- browser: Chromium qua Playwright 1.56.1
- database: PostgreSQL local: careermate_v2_test và careermate_v2_migration_check
- node: v26.7.0
- os: macOS Darwin arm64
- python: 3.12.8
