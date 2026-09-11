# CareerMate v2 — Mục tiêu triển khai

Rebuild CareerMate trong `v2/` bằng FastAPI/PostgreSQL và Next.js/Tailwind,
giữ v1 làm nguồn đối chiếu read-only. Bản v2 phải bảo toàn tenant isolation,
AI proposal-before-persist, provenance, design Milo và bằng chứng kiểm thử theo
đúng commit SHA.

## Ranh giới an toàn

- Chỉ thay đổi code mới dưới `v2/` trong branch `feat/v2-rebuild` hoặc slice branch.
- Không stash, reset, clean hoặc sửa checkout `master` đang có WIP.
- Không đọc, in, sao chép hoặc commit secret thật.
- Không chạy migration trên DB v1/production; không force-push hoặc merge master.
- Agent report không phải bằng chứng hoàn thành nếu Codex chưa chạy lại gate.

## Definition of done

Một feature chỉ hoàn thành khi contract, implementation, tests, code review,
UI/UX persona review, báo cáo tiếng Việt và push verification đều cùng trỏ tới
implementation SHA đã xác minh.
