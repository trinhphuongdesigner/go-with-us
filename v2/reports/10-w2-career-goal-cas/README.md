# W2-CAREER-GOAL-CAS — Báo cáo QA

Trạng thái: **PASS** tại implementation SHA `08b0cd6c6cac1c91f2a9c284a4d00a1fdf8ae9ea`. Reviewer độc lập đã **FINAL APPROVE, 0 P0/P1/P2**; cả ba finding vòng đầu đã đóng.

## Ý nghĩa chức năng

Career Goal dùng `version` để ngăn hai tab âm thầm ghi đè hoặc xóa dữ liệu của nhau. PATCH và DELETE chỉ thành công khi `expectedVersion` vẫn trùng với bản ghi của đúng người dùng và đúng công ty. Khi xung đột, backend trả `409` cùng `currentVersion`; frontend giữ bản nháp hoặc hộp xác nhận, tải lại dữ liệu server và giải thích rõ việc chưa được áp dụng.

## Thay đổi trong candidate

- Sửa frontend để nhận diện chính xác payload `version_conflict` dạng object thay vì chỉ hiện “Yêu cầu không thành công”.
- Khi PATCH/DELETE gặp 409, mutation chờ refetch hoàn tất nhưng snapshot đang sửa/xóa vẫn giữ nguyên. Nút mở/hủy bị khóa trong lúc recovery để không chụp lại version cũ.
- Nếu refetch thất bại, giao diện nói rõ chưa tải được dữ liệu mới và không tuyên bố recovery thành công.
- Hủy rồi mở lại sẽ reset lỗi mutation và chụp version mới vừa tải từ server.
- Bổ sung backend regression test cho category/status/due date/progress, PATCH rỗng, owner/tenant scope và hai writer đồng thời trên PostgreSQL.
- Backend product contract về version/CAS/migration đã có trong base từ `f5d7fb0`; candidate không thay đổi route, model, schema hoặc migration.

## Bằng chứng trên implementation SHA

- RED frontend: `2 failed, 2 passed`; lỗi đúng vì thông báo còn chung và chưa có refresh/reset.
- GREEN frontend sau remediation review: `1 file, 5 tests passed`, gồm deferred refetch và refetch failure.
- PostgreSQL focused: `4 passed in 3.64s`, gồm test concurrent transaction.
- PostgreSQL-only test dùng barrier ngay trước production UPDATE với hai HTTP client và hai DB transaction riêng; có timeout và assert cả hai writer đã tới barrier.
- Backend SQLite full: `680 passed, 19 skipped in 82.42s`.
- Ruff **PASS**; mypy `app` **PASS** trên 90 source files.
- Frontend full: `25 files, 177 tests passed`; ESLint và TypeScript **PASS**.
- Next.js production build **PASS**, static generation `17/17`.
- Independent review: **FINAL APPROVE, 0 P0/P1/P2**.

## Giới hạn còn mở

- Playwright/browser/persona/accessibility/performance vẫn **NOT_RUN** theo chỉ đạo.
- Không có file v1 nào được sửa, stage, commit hoặc reset trong task này.

Ba finding vòng đầu (`P1-1`, `P2-1`, `P2-2`) đều **CLOSED** sau re-review.
