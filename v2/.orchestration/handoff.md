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

- Gate working tree hiện tại: SQLite 655 passed/18 skipped; PostgreSQL 17 sạch 673 passed; Alembic `0001` → `0018` và drift PASS; frontend 148 Vitest, ESLint, TypeScript và production build PASS; Ruff/mypy/audit PASS.
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
