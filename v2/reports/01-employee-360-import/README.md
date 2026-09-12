# Wave 1 — Employee 360°, nhập tài liệu có dẫn nguồn và selective apply

- **Mã tính năng:** 01-employee-360-import
- **Nhánh:** feat/v2-rebuild
- **Implementation SHA:** `de246d8c74ec8425cec0172613012fc600811719`
- **Thời điểm tạo:** 2026-09-12T09:53:00+07:00
- **Kết quả:** **PASS**

## Giá trị sử dụng

Nhân viên có thể chuyển tài liệu nghề nghiệp thành đề xuất hồ sơ có dẫn nguồn, kiểm tra từng dữ kiện trước khi lưu và không gặp hồ sơ nửa vời khi một bước thất bại.

## Phạm vi

- Nhận PDF, DOCX, PNG, JPEG, WebP, văn bản, CSV và XLSX với kiểm tra MIME, kích thước, malware, file trùng và giới hạn tài nguyên parser.
- Lưu SourceDocument, SourceVersion, SourceBlock, EvidenceRef, AIInvocation và ProposedValue trong company scope của chủ hồ sơ.
- Tạo đề xuất AI có schema, evidence và trạng thái rõ; nội dung thiếu nguồn hoặc mơ hồ không được tự áp dụng.
- Cho người dùng xem nguồn, chọn từng trường và apply nguyên tử với version, lock và idempotency.
- Cung cấp UI nhập tài liệu responsive, demo có nhãn, trạng thái loading/empty/error/stale, bàn phím và reduced motion.

## Phân rã chức năng

1. **Nhân viên:** Chọn tài liệu hỗ trợ, nhận hướng dẫn định dạng và trạng thái xử lý bằng tiếng Việt.
2. **Backend:** Kiểm tra file, hash chống trùng, quét malware và trích xuất block có thứ tự trong sandbox tài nguyên giới hạn.
3. **AI gateway:** Sinh ProposedValue đúng schema, tham chiếu EvidenceRef hợp lệ và không ghi hồ sơ trực tiếp.
4. **Nhân viên:** Mở từng đề xuất, đối chiếu nguồn, chọn trường cần lưu hoặc yêu cầu xử lý lại khi dữ kiện chưa đủ.
5. **Profile service:** Khóa phiên bản, kiểm tra idempotency rồi apply toàn bộ lựa chọn trong một transaction cùng provenance và activity log.
6. **Quản lý hoặc HR:** Chỉ thấy dữ liệu thuộc công ty và phạm vi quyền được backend cấp; không thể truy cập import của tenant khác.

## Tiêu chí nghiệm thu

- **AC-01 · PASS:** File intake kiểm tra định dạng, kích thước, malware, trùng lặp và giới hạn tài nguyên trước khi tạo đề xuất. (bằng chứng: CHK-INTEGRATION, CHK-SECURITY)
- **AC-02 · PASS:** Mọi dữ kiện AI có evidence hợp lệ; dữ kiện mơ hồ, prompt injection hoặc ID bịa bị chặn; proposal không tự persist. (bằng chứng: CHK-AI-GROUNDING, CHK-INTEGRATION)
- **AC-03 · PASS:** Selective apply nguyên tử, idempotent và từ chối stale/concurrent update mà không tạo hồ sơ nửa vời. (bằng chứng: CHK-INTEGRATION)
- **AC-04 · PASS:** Owner và company scope được áp dụng trên API, repository và khóa ngoại để ngăn truy cập chéo tenant. (bằng chứng: CHK-INTEGRATION, CHK-SECURITY)
- **AC-05 · PASS:** OpenAPI, generated client và migration khớp implementation SHA. (bằng chứng: CHK-CONTRACT, CHK-MIGRATION)
- **AC-06 · PASS:** UI import rõ ràng, responsive và đạt keyboard, focus, reduced motion, axe trên ba viewport. (bằng chứng: CHK-E2E, CHK-ACCESSIBILITY, CHK-MANUAL-UI)
- **AC-07 · PASS:** Code format, lint, typecheck, unit test và production build đều đạt trên exact SHA. (bằng chứng: CHK-FORMAT, CHK-LINT, CHK-TYPE, CHK-UNIT, CHK-BUILD)
- **AC-08 · PASS:** Không có security critical/high, dependency vulnerability hoặc secret trong committed diff. (bằng chứng: CHK-SECURITY)
- **AC-09 · PASS:** Trang import production build giữ LCP dưới 2.5 giây trong ba viewport kiểm tra. (bằng chứng: CHK-PERFORMANCE)

## Kiểm thử và bằng chứng

### CHK-FORMAT · PASS

- Loại: FORMAT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff format --check app tests`
- Thư mục: `v2/backend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Ruff xác nhận 61 file đã được format.
- Số liệu: files=61

### CHK-LINT · PASS

- Loại: LINT
- Bắt buộc: Có
- Lệnh: `.venv/bin/ruff check app tests và npm run lint`
- Thư mục: `v2`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Backend và frontend không có lint error hoặc warning.
- Số liệu: errors=0, warnings=0

### CHK-TYPE · PASS

- Loại: TYPECHECK
- Bắt buộc: Có
- Lệnh: `.venv/bin/mypy app scripts và npm run typecheck`
- Thư mục: `v2`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Mypy PASS 35 source file và TypeScript PASS 0 lỗi.
- Số liệu: backend_files=35, errors=0

### CHK-UNIT · PASS

- Loại: UNIT
- Bắt buộc: Có
- Lệnh: `npm run test`
- Thư mục: `v2/frontend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Vitest PASS 21 test trong 6 suite.
- Artifact: `v2/frontend/tests`
- Số liệu: failed=0, passed=21, suites=6

### CHK-INTEGRATION · PASS

- Loại: INTEGRATION
- Bắt buộc: Có
- Lệnh: `DATABASE_URL=postgresql+asyncpg://[REDACTED] .venv/bin/pytest -q`
- Thư mục: `v2/backend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: 205 backend test PASS trên PostgreSQL; SQLite chạy bổ sung 196 PASS và 9 PostgreSQL-only skip. Fixture chỉ DELETE theo thứ tự khóa ngoại, không drop hoặc truncate.
- Artifact: `v2/backend/tests`, `v2/reports/01-employee-360-import/traces/exact-sha-evidence.json`
- Số liệu: duration_seconds=53.63, postgresql_passed=205, sqlite_passed=196, sqlite_skipped=9

### CHK-CONTRACT · PASS

- Loại: CONTRACT
- Bắt buộc: Có
- Lệnh: `python scripts/export_openapi.py và scripts/check-openapi-contract.sh`
- Thư mục: `v2`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: OpenAPI 3.1 snapshot và generated TypeScript contract hiện tại, không có drift.
- Artifact: `v2/contracts/openapi.json`, `v2/contracts/generated/openapi.ts`
- Số liệu: stale_contracts=0

### CHK-MIGRATION · PASS

- Loại: MIGRATION
- Bắt buộc: Có
- Lệnh: `alembic upgrade head và alembic check trên careermate_v2_migration_check`
- Thư mục: `v2/backend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Migration 0006 và các migration trước nâng schema thành công; Alembic không phát hiện drift.
- Artifact: `v2/backend/alembic/versions`
- Số liệu: drift_operations=0, head_revision=0006_profile_import

### CHK-BUILD · PASS

- Loại: BUILD
- Bắt buộc: Có
- Lệnh: `NEXT_PUBLIC_BUILD_SHA=&lt;exact_sha&gt; npm run build`
- Thư mục: `v2/frontend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Next.js 16.3.5 production build PASS và nhúng đúng implementation SHA.
- Số liệu: errors=0

### CHK-E2E · PASS

- Loại: E2E
- Bắt buộc: Có
- Lệnh: `CAREERMATE_EXPECTED_SHA=&lt;exact_sha&gt; CAREERMATE_E2E_USE_BUILD=true npm run test:e2e`
- Thư mục: `v2/frontend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: 36 Playwright scenario PASS trên production build ở 390×844, 768×1024 và 1440×900, gồm luồng import, error và stale state.
- Artifact: `v2/frontend/tests/e2e/profile-import.spec.ts`, `v2/reports/01-employee-360-import/screenshots/manifest.json`
- Số liệu: failed=0, passed=36, viewports=3

### CHK-ACCESSIBILITY · PASS

- Loại: ACCESSIBILITY
- Bắt buộc: Có
- Lệnh: `npm run test:e2e (axe, keyboard focus, touch targets và reduced motion)`
- Thư mục: `v2/frontend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Axe 0 violation; focus hiển thị, thao tác bàn phím và reduced motion được kiểm tra trên ba viewport.
- Artifact: `v2/frontend/tests/e2e/profile-import.spec.ts`
- Số liệu: axe_violations=0, keyboard_alternative=True, reduced_motion=True, viewports=3

### CHK-SECURITY · PASS

- Loại: SECURITY
- Bắt buộc: Có
- Lệnh: `bandit -ll; pip-audit; npm audit --omit=dev; gitleaks git origin/master..HEAD`
- Thư mục: `v2`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Bandit có 0 medium/high; Python và npm production có 0 vulnerability; Gitleaks quét 6 commit, 1.47 MB và không phát hiện secret.
- Artifact: `v2/backend/app/security`, `v2/backend/tests/test_profile_import_security.py`
- Số liệu: bandit_medium_high=0, critical_high=0, dependency_vulnerabilities=0, gitleaks_findings=0

### CHK-PERFORMANCE · PASS

- Loại: PERFORMANCE
- Bắt buộc: Có
- Lệnh: `npm run test:e2e (profile import LCP budget)`
- Thư mục: `v2/frontend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Trang import production build đạt ngân sách LCP dưới 2500 ms trong cả ba viewport; suite chỉ lưu kết quả đạt ngưỡng, không ghi số đo giả.
- Artifact: `v2/frontend/tests/e2e/profile-import.spec.ts`
- Số liệu: budget_ms=2500, scenarios_under_budget=3

### CHK-AI-GROUNDING · PASS

- Loại: AI_GROUNDING
- Bắt buộc: Có
- Lệnh: `.venv/bin/pytest tests/test_profile_import_ai.py tests/test_profile_import_security.py tests/test_profile_import_api.py -q`
- Thư mục: `v2/backend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: 74 focused case PASS; 5 PostgreSQL-only case được bao phủ trong full PostgreSQL run. Suite chặn invented ID, thiếu evidence, prompt injection, timeout và auto-persist.
- Artifact: `v2/backend/tests/test_profile_import_ai.py`, `v2/contracts/ai-golden-evals.yaml`
- Số liệu: focused_passed=74, invented_ids_accepted=0, postgresql_only_covered=5, unsupported_values_accepted=0

### CHK-MANUAL-UI · PASS

- Loại: MANUAL_UI
- Bắt buộc: Có
- Lệnh: `Independent persona review và đối chiếu manifest/checksum ảnh production exact SHA`
- Thư mục: `v2/frontend`
- SHA: `de246d8c74ec8425cec0172613012fc600811719`
- Kết quả: Antigravity correction review độc lập xác nhận PASS với 0 P0, 0 P1 và 0 P2 sau khi đối chiếu code, manifest cùng 7 ảnh mới trên 3 viewport. Ảnh demo chỉ là bằng chứng UX, không khẳng định provider/backend live.
- Artifact: `v2/reports/01-employee-360-import/screenshots`, `v2/reports/01-employee-360-import/screenshots/manifest.json`
- Số liệu: checksum_mismatches=0, open_p0=0, open_p1=0, open_p2=0, personas_passed=5, resolved_previous_p1=3, resolved_previous_p2=3, screenshots=7

## Review UI/UX theo persona

### EMPLOYEE_22_30 · 390x844 · PASS

- **P2:** Ảnh dùng dữ liệu demo để minh họa luồng đề xuất. → Đã gắn nhãn demo rõ và không diễn giải ảnh thành bằng chứng AI/backend live.

### HR_35_45 · 1440x900 · PASS

- **P2:** Danh sách nhân sự và roster tổng thể chưa thuộc slice import. → Giữ trong Wave 1 IN_PROGRESS và triển khai ở slice Employee 360 tiếp theo.

### MANAGER_45_55 · 1440x900 · PASS

- Không còn finding mở trong phạm vi review.

### LOW_TECH_USER · 768x1024 · PASS

- **P2:** Người trên 50 tuổi cần giữ cỡ chữ hướng dẫn tối thiểu 14px và tên file không phá layout. → Đã nâng nội dung trợ giúp lên text-sm, đổi thuật ngữ kỹ thuật sang tiếng Việt và cho filename wrap an toàn.

## API, schema và giao diện thay đổi

- API · POST/GET /api/v2/profile-imports: Thêm upload, danh sách phân trang và detail theo owner/company scope.
- API · POST /api/v2/profile-imports/{id}/parse và /apply: Thêm parse có fencing và selective apply nguyên tử với version cùng idempotency key.
- API · DELETE /api/v2/profile-imports/{id}: Thêm xóa nguồn chưa áp dụng theo quyền và phạm vi tenant.
- DATABASE · SourceDocument, SourceVersion, SourceBlock, EvidenceRef, AIInvocation, ProposedValue, ProfileProvenance, ProfileApplyReceipt: Thêm mô hình provenance, composite tenant keys, optimistic version và audit cho import.
- AI_SCHEMA · ProfileImportProposal: Thêm kết quả typed với status, evidence refs, warnings, trace, prompt/schema/model metadata và kiểm tra allowlist.
- UI_ROUTE · /ho-so/import và /ho-so/import/:importId: Thêm luồng tải file, xem đề xuất có nguồn, chọn từng trường và xử lý loading/empty/error/stale.

## Bảo mật và quyền riêng tư

- API và repository lọc company_id cùng owner; composite foreign key ngăn liên kết evidence/proposal sang tenant khác.
- Parser PDF và OCR chạy trong worker có wall/CPU/RSS/output limit, semaphore concurrency, cancel và kill/reap.
- ZIP, ảnh nén và dimension bomb bị chặn; ClamAV và Tesseract fail-closed khi dịch vụ không sẵn sàng.
- PostgreSQL test fixture không drop hoặc truncate; chỉ DELETE dữ liệu test theo thứ tự khóa ngoại.
- Report, committed diff và telemetry không chứa secret, raw CV hoặc dữ liệu nhân sự thật.

## AI và kiểm soát nguồn

- ProfileImportProposal dùng Pydantic schema, allowlisted IDs, evidence coverage và semantic validation ở server.
- Prompt injection trong tài liệu được xem là dữ liệu không tin cậy và không thể thay đổi system instruction hoặc bật tool.
- Proposal không tự persist; chỉ selective apply được người dùng xác nhận mới ghi trong transaction.
- Provider runtime thật chưa chạy trong gate này; deterministic demo được gắn nhãn và không được coi là behavioral provider PASS.

## Ảnh kiểm chứng

- /ho-so/import · 390x844 · v2/reports/01-employee-360-import/screenshots/import-390x844.png · SHA de246d8c74ec8425cec0172613012fc600811719
- /ho-so/import/:importId · 390x844 · v2/reports/01-employee-360-import/screenshots/proposal-390x844.png · SHA de246d8c74ec8425cec0172613012fc600811719
- /ho-so/import · 768x1024 · v2/reports/01-employee-360-import/screenshots/import-768x1024.png · SHA de246d8c74ec8425cec0172613012fc600811719
- /ho-so/import/:importId · 768x1024 · v2/reports/01-employee-360-import/screenshots/proposal-768x1024.png · SHA de246d8c74ec8425cec0172613012fc600811719
- /ho-so/import · 1440x900 · v2/reports/01-employee-360-import/screenshots/import-1440x900.png · SHA de246d8c74ec8425cec0172613012fc600811719
- /ho-so/import/:importId · 1440x900 · v2/reports/01-employee-360-import/screenshots/proposal-1440x900.png · SHA de246d8c74ec8425cec0172613012fc600811719
- /ho-so/import/:importId với COMPANY_ADMIN · 1440x900 · v2/reports/01-employee-360-import/screenshots/proposal-company-admin-1440x900.png · SHA de246d8c74ec8425cec0172613012fc600811719

## Giới hạn và việc tiếp theo

- Ảnh và E2E dùng deterministic demo fixture; chưa chứng minh provider AI thật hoặc frontend gọi backend live. (ảnh hưởng: MEDIUM) → Chạy provider evaluation bằng synthetic data và live API wiring khi metadata/provider được xác minh.
- Wave 1 chưa có đầy đủ profile aggregate, kinh nghiệm, dự án, chứng chỉ, giải thưởng, timeline và roster HR. (ảnh hưởng: HIGH) → Tiếp tục slice Employee 360 core và roster; giữ Wave 1 ở IN_PROGRESS.
- Chưa có load benchmark p95 cho non-AI API trên demo dataset. (ảnh hưởng: MEDIUM) → Đo và lưu trace p95 trong Wave 6 hardening.

## Môi trường đã che thông tin nhạy cảm

- ai_provider: None
- browser: Chromium qua Playwright 1.63.0
- database: PostgreSQL local: careermate_v2_test và careermate_v2_migration_check
- node: v26.7.0
- os: macOS Darwin arm64
- python: 3.12.8
