# Hợp nhất v2 — remediation bảo mật, dữ liệu, AI và concurrency

- **Mã tính năng:** 03-consolidation-remediation
- **Nhánh:** codex/v2-qa-consolidation
- **Implementation SHA:** `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- **Thời điểm tạo:** 2026-09-13T03:36:00Z
- **Kết quả:** **BLOCKED**

## Giá trị sử dụng

Team có một candidate v2 duy nhất, giữ UI CareerMate hiện tại và logic mới, với backend deterministic/evidence-first và trạng thái kiểm thử minh bạch để bắt đầu manual QA.

## Phạm vi

- Hợp nhất các thay đổi v2 sau khi đồng bộ feature từ main/worktree mà không stage thay đổi v1.
- Khép P0/P1 về tenant/RBAC, optimistic locking, scoring, AI evidence, import và hiệu năng truy vấn.
- Khóa contract OpenAPI, migration 0001 đến 0018 và bằng chứng test trên PostgreSQL sạch.
- Chuẩn bị branch và báo cáo tiếng Việt cho tester, ghi rõ browser gate chưa chạy.

## Phân rã chức năng

1. **Employee/HR:** Cập nhật mục tiêu, hồ sơ và roadmap bằng version; stale write/delete nhận 409.
2. **HR/BOD:** Cross Assessment và Passport dùng snapshot bất biến, weighted score do backend tính và narrative có evidence.
3. **HR/Staffing:** People Search áp hard filter, deterministic rank, tenant scope và canonical AI citations.
4. **AI gateway:** Chỉ nhận provider output đúng schema/allowlist; thiếu evidence fail-closed và không tự persist.
5. **Tester:** Lấy đúng branch/SHA, chạy manual flows; không diễn giải Playwright NOT_RUN thành PASS.

## Tiêu chí nghiệm thu

- **AC-01 · PASS:** Không còn P0/P1 có thể hành động trong review độc lập của remediation. (bằng chứng: CHK-REVIEW)
- **AC-02 · PASS:** Backend, migration và database thật đạt trên PostgreSQL test sạch. (bằng chứng: CHK-INTEGRATION, CHK-MIGRATION)
- **AC-03 · PASS:** Frontend contract, unit, lint, typecheck và production build đạt. (bằng chứng: CHK-CONTRACT, CHK-UNIT, CHK-LINT, CHK-TYPE, CHK-BUILD)
- **AC-04 · PASS:** Static security và dependency audit không có medium/high hoặc vulnerability đã biết. (bằng chứng: CHK-SECURITY)
- **AC-05 · NOT_RUN:** Browser, accessibility, visual regression và persona review đạt trên implementation SHA. (bằng chứng: CHK-E2E, CHK-ACCESSIBILITY, CHK-PERFORMANCE, CHK-MANUAL-UI)

## Kiểm thử và bằng chứng

### CHK-FORMAT · PASS

- Loại: FORMAT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff format --check app tests`
- Thư mục: `v2/backend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: 144 file Python đã format.
- Số liệu: files=144

### CHK-LINT · PASS

- Loại: LINT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff check app tests và npm run lint`
- Thư mục: `v2`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Backend/frontend không có lint error.
- Số liệu: errors=0

### CHK-TYPE · PASS

- Loại: TYPECHECK
- Bắt buộc: Có
- Lệnh: `.venv/bin/mypy app và npm run typecheck`
- Thư mục: `v2`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Mypy 90 source file và TypeScript đạt.
- Số liệu: python_source_files=90, typescript_errors=0

### CHK-UNIT · PASS

- Loại: UNIT
- Bắt buộc: Có
- Lệnh: `npm test -- --run`
- Thư mục: `v2/frontend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: 148 Vitest trong 20 file đạt.
- Số liệu: files=20, tests=148

### CHK-INTEGRATION · PASS

- Loại: INTEGRATION
- Bắt buộc: Có
- Lệnh: `pytest trên SQLite và PostgreSQL 17 careermate_v2_test`
- Thư mục: `v2/backend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: SQLite 655 passed/18 skipped; PostgreSQL sạch 673 passed.
- Số liệu: postgresql_passed=673, sqlite_passed=655, sqlite_skipped=18

### CHK-CONTRACT · PASS

- Loại: CONTRACT
- Bắt buộc: Có
- Lệnh: `export_openapi; npm run contracts:generate; npm run contracts:check`
- Thư mục: `v2`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: OpenAPI và generated TypeScript client current sau commit.
- Số liệu: drift=False

### CHK-MIGRATION · PASS

- Loại: MIGRATION
- Bắt buộc: Có
- Lệnh: `alembic upgrade head; alembic check trên PostgreSQL sạch`
- Thư mục: `v2/backend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Nâng 0001 đến 0018 thành công; không drift.
- Số liệu: drift=False, head=0018_career_goal_version

### CHK-BUILD · PASS

- Loại: BUILD
- Bắt buộc: Có
- Lệnh: `npm run build`
- Thư mục: `v2/frontend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Next.js 16 production build đạt, 17 routes.
- Số liệu: routes=17

### CHK-SECURITY · PASS

- Loại: SECURITY
- Bắt buộc: Có
- Lệnh: `bandit -ll; pip-audit --strict; npm audit --omit=dev --audit-level=high`
- Thư mục: `v2`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Bandit 0 medium/high; Python/npm 0 vulnerability đã biết. Gitleaks được ghi riêng trong known gaps.
- Số liệu: bandit_high=0, bandit_medium=0, known_vulnerabilities=0

### CHK-AI-GROUNDING · PASS

- Loại: AI_GROUNDING
- Bắt buộc: Có
- Lệnh: `pytest AI/RAG/offboarding/job-matching regression trong full backend suite`
- Thư mục: `v2/backend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Schema, allowlist, evidence, prompt injection và deterministic scoring regressions đạt.
- Số liệu: invented_ids_accepted=0

### CHK-REVIEW · PASS

- Loại: SECURITY
- Bắt buộc: Có
- Lệnh: `Independent read-only review of original P0/P1 remediation`
- Thư mục: `v2`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: APPROVE; không còn P0/P1 có thể hành động.
- Số liệu: open_p0=0, open_p1=0

### CHK-E2E · NOT_RUN

- Loại: E2E
- Bắt buộc: Có
- Lệnh: `npm run test:e2e`
- Thư mục: `v2/frontend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Playwright tạm dừng theo yêu cầu user.

### CHK-ACCESSIBILITY · NOT_RUN

- Loại: ACCESSIBILITY
- Bắt buộc: Có
- Lệnh: `npm run test:e2e (axe/keyboard/reduced motion)`
- Thư mục: `v2/frontend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Chưa có browser evidence mới cho candidate hợp nhất.

### CHK-PERFORMANCE · NOT_RUN

- Loại: PERFORMANCE
- Bắt buộc: Có
- Lệnh: `npm run test:e2e (LCP budget)`
- Thư mục: `v2/frontend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Chưa đo LCP trên candidate hợp nhất.

### CHK-MANUAL-UI · NOT_RUN

- Loại: MANUAL_UI
- Bắt buộc: Có
- Lệnh: `Manual persona/browser review`
- Thư mục: `v2/frontend`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Chờ tester và browser gate.

### CHK-PUSH · PASS

- Loại: PUSH
- Bắt buộc: Không
- Lệnh: `git push origin codex/v2-qa-consolidation`
- Thư mục: `.`
- SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Kết quả: Nhánh origin/codex/v2-qa-consolidation đã chứa implementation f5d7fb093f0cd7f577131111222bcd2d8a43459c và report/handoff tại remote head 0ef9f94575592b37d20d8226c3a46dfbb22938bf.
- Số liệu: remote_head=0ef9f94575592b37d20d8226c3a46dfbb22938bf

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

- API · Career goals, assistant, profile import, assessment, passport và staffing: Tăng validation, tenant scope, optimistic locking và evidence contract.
- DATABASE · Alembic 0017-0018 và các migration đã hòa giải: Khóa default role grants và version CareerGoal; clean upgrade không drift.
- AI_SCHEMA · Roster claims, offboarding claims và matching explanations: Provider chỉ chọn opaque refs; backend xác minh và dựng dữ kiện canonical.
- UI_ROUTE · Roadmap, Passport, People Search và profile: Giữ design hiện tại, thêm stale/error/approval states và contract mới.

## Bảo mật và quyền riêng tư

- Không stage thay đổi v1 ở root; commit implementation chỉ chứa v2.
- Không đọc, in hoặc commit credential; provider live không được gọi.
- Tenant/RBAC, stale write, AI invented ref và PII log có regression tests.
- PostgreSQL test cũ bị schema/version drift được giữ nguyên, không xóa hoặc truncate.

## AI và kiểm soát nguồn

- AI không tính assessment/passport/staffing score và không ghi database trực tiếp.
- Roster/offboarding/matching chỉ chấp nhận opaque candidate/evidence refs thuộc allowlist.
- Thiếu evidence, provider timeout hoặc invalid schema trả lỗi/fallback có nhãn; không tạo dữ liệu giả âm thầm.

## Ảnh kiểm chứng

- Không có.

## Giới hạn và việc tiếp theo

- Playwright, axe, visual regression và persona review chưa chạy theo yêu cầu tạm dừng. (ảnh hưởng: HIGH) → Tester chạy manual flow; chỉ mở automated browser gate khi user cho phép.
- Gitleaks exact-SHA chưa chạy vì binary không có trong checkout. (ảnh hưởng: MEDIUM) → Chạy secret scan trên committed range trước merge/cutover.
- PostgreSQL test cũ ở cổng 55432 có Alembic stamp 0004 nhưng schema từng được metadata bổ sung. (ảnh hưởng: LOW) → Không dùng làm evidence; giữ nguyên cho đến khi có kế hoạch reset test environment riêng.

## Môi trường đã che thông tin nhạy cảm

- ai_provider: None
- browser: NOT_RUN theo yêu cầu user
- database: PostgreSQL 17 cô lập careermate_v2_test và SQLite in-memory
- node: v26.7.0
- os: macOS Darwin arm64
- python: 3.12.8
