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

## Tiếp tục an toàn

- Xác minh `git branch --show-current` là `feat/v2-rebuild`.
- Chạy `git status --short`; chỉ thao tác dưới `v2/`.
- Đọc kết quả Pi/subagent, nhưng chạy lại lệnh kiểm thử trước khi ghi PASS.
- Không đưa giá trị env hoặc credential vào transcript/report.

## Trạng thái hiện tại

- Wave 0 PASS tại SHA `01e1e87838d9cd4473a0e661b6dd75291b5119e6`; report chuẩn ở `../reports/00-foundation/qa-report.json`.
- Toàn dự án vẫn IN_PROGRESS; không diễn giải Wave 0 PASS thành full rebuild hoàn tất.
- Slice import của Wave 1 PASS tại SHA `de246d8c74ec8425cec0172613012fc600811719`; report chuẩn ở `../reports/01-employee-360-import/qa-report.json`.
- Slice core profile/roster PASS tại SHA `ca230bceb3b2d9be473fa8f842b23ecd51379115`; report chuẩn ở `../reports/02-core-profile-roster/qa-report.json`.
- Wave 1 vẫn IN_PROGRESS vì CRUD resource aggregate và unified timeline chưa hoàn tất.
- Không gọi lại Pi Desktop trong trạng thái bàn giao hiện tại; Codex là writer duy nhất, Antigravity chỉ review đọc theo từng slice.
- Bước tiếp theo: triển khai CRUD kỹ năng, kinh nghiệm, dự án, chứng chỉ, giải thưởng, provenance và unified timeline trong company scope.
- Mọi endpoint v2 dùng `/api/v2`; inventory v1 chỉ là evidence, không phải executable contract.
- File intake phải kiểm tra MIME/size/malware/hash cho PDF, DOCX, ảnh, text, CSV và XLSX; parse không tự persist; selective apply dùng transaction, version, idempotency và rollback.
