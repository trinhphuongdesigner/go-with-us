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
