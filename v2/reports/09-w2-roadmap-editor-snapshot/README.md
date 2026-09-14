# W2-ROADMAP-EDITOR-SNAPSHOT — Báo cáo QA

Trạng thái: **PASS** tại implementation SHA `f9f3e405c469d201859c85d1647eb4d6aa73c0ce`. Reviewer độc lập đã **FINAL APPROVE, 0 P0/P1/P2**; P2 duy nhất đã đóng.

## Ý nghĩa chức năng

- Khi người dùng mở hộp thoại xóa, hệ thống giữ đúng `id`, `version` và tên lộ trình tại thời điểm đó. Việc chọn lộ trình khác trong lúc hộp thoại đang mở không thể làm xóa nhầm.
- Khi mở editor, lộ trình và version được chụp lại thành một snapshot. Cache nền có đổi sang version mới thì bản nháp cũ vẫn gửi version đã mở để backend trả 409, thay vì âm thầm ghi đè dữ liệu mới.
- Sau 409, bản nháp vẫn còn để người dùng đối chiếu. Cancel rồi mở lại sẽ xóa lỗi mutation cũ và lấy snapshot mới. Checkbox tiến độ bị khóa khi editor đang mở để tránh hai thao tác cạnh tranh trên cùng version.

## Phạm vi và kết quả

- Base hiện tại đã chứa hai bản sửa snapshot chính từ consolidation `f5d7fb0`; candidate bổ sung regression evidence còn thiếu cho dialog title/selection, 409 preservation và reset khi reopen.
- RED được chạy thật trong worktree tạm detached tại pre-fix SHA `c1148d6`: đúng hai test gốc đều thất bại. Delete gọi B v7 thay vì snapshot A v3; editor gửi version 4 từ cache thay vì snapshot version 3. Worktree tạm đã được xóa sau kiểm tra.
- P2 review về đồng bộ test delete đã đóng: DELETE response được giữ pending; test xác nhận request A v3 và nút confirmation bị disabled, sau đó resolve response và chờ confirmation UI biến mất trước khi assert selection/heading B.
- Focused Vitest: `1 file, 3 tests passed`.
- Focused ESLint: **PASS**.
- TypeScript `tsc --noEmit`: **PASS**.
- Backend chỉ audit tĩnh: PUT/DELETE dùng query scope `owner_user_id + company_id`, `with_for_update()` và kiểm tra version trước khi clear milestone hoặc delete row.
- Logic sản phẩm không cần sửa thêm trong slice này. Product fix được kế thừa từ consolidation `f5d7fb0`; implementation commit `f9f3e40` chỉ chứa regression test.

## Bằng chứng trên exact implementation commit

- Backend: `CAREERMATE_DEMO_LOGIN_ENABLED=false .venv/bin/pytest -q` → **678 passed, 18 skipped in 61.40s**.
- Ruff: `.venv/bin/ruff check .` → **PASS**.
- mypy: `.venv/bin/mypy app` → **PASS, 90 source files**.
- Frontend: `npm test` → **25 files, 174 tests passed**.
- ESLint, TypeScript và Next.js production build → **PASS**, static generation **17/17**.
- Review độc lập: **FINAL APPROVE, 0 P0/P1/P2**; P2 duy nhất **CLOSED**.
- JSON và `git diff --check`: **PASS** sau cập nhật tài liệu.

## Giới hạn còn mở

- Playwright, browser, persona, accessibility và performance vẫn **NOT_RUN** theo chỉ đạo.
- Các file v1 dirty từ trước nằm ngoài phạm vi và không được stage.
