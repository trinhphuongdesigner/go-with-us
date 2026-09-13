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

## Trạng thái điều phối hiện tại

- User đã cho phép tiếp tục remediation; Playwright/browser automation vẫn tạm dừng.
- Worktree chuẩn hiện là `.claude/worktrees/v2-qa`, branch `codex/v2-qa-consolidation`.
- Source hợp nhất đã khóa tại implementation SHA `f5d7fb093f0cd7f577131111222bcd2d8a43459c`; independent remediation review không còn P0/P1.
- Candidate chưa đạt Definition of done vì browser/persona gate và Gitleaks exact-SHA chưa chạy. Xem `consolidation-remediation-2026-09-13.vi.md`, report `03-consolidation-remediation` và `quality-gates.json`.
