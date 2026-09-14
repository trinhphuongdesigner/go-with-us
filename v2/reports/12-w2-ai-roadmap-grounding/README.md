# W2-AI-ROADMAP-GROUNDING

Trạng thái: **PASS** tại implementation SHA `546d5786be900ce003e768ed4602a4015701bb90`, được xác minh lại trong integrated verification SHA `c0a1fee65fcc66f3e1e4241252b5b1a7cd4645c4` có cùng phần AI implementation và dashboard đã được phê duyệt riêng.

Slice này buộc Milo trả lộ trình theo schema có `subjectId`, `sourceEntityIds` và `evidenceRefs` trong allowlist do server tạo từ profile mà người dùng được phép đọc. Proposal, từng chặng và từng task đều phải có evidence. JSON/schema sai, ID bịa, thiếu bằng chứng, timeout hoặc response rỗng đều dừng trước khi tạo conversation, message, goal hay roadmap.

Profile records được đóng gói dưới nhãn `UNTRUSTED_DATA` và không nối vào system prompt. Câu trả lời tự do của provider không được hiển thị hay lưu cho roadmap; proposal hợp lệ chỉ đi trong response tạm để frontend mở editor. History giữ `proposalData=null`; chỉ nút xác nhận trong editor mới gọi API lưu. Khi proposal đang mở, giao diện khóa gửi/chuyển hội thoại cho đến khi người dùng lưu hoặc bỏ; proposal mới reset trạng thái save cũ trước khi cài vào editor.

## Bằng chứng

- Independent final review: **APPROVE, 0 P0/P1/P2**; `P1-1` và `P2-1` CLOSED.
- Backend full: **694 passed, 20 skipped trong 71.47s**.
- Ruff: PASS; mypy: PASS trên 90 source files.
- Frontend full: **27 files, 190 tests PASS trong 10.43s**; ESLint và TypeScript PASS.
- Next.js production build: PASS trong 12.45s; **17/17 routes**.
- Browser/Playwright/persona/accessibility/performance: NOT_RUN theo chỉ đạo.
- Provider live: NOT_RUN.

## Giới hạn

Evidence hiện là token xác định từ snapshot profile được phép đọc, chưa phải citation `SourceBlock` bền vững. Allowlist ngăn ID bịa nhưng chưa tự đo quan hệ ngữ nghĩa giữa từng claim và đoạn evidence. Provider live và browser QA vẫn cần một gate riêng trước quyết định production.

Nguồn chuẩn: `qa-report.json`.
