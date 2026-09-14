# W5-DASHBOARD-ROLE-AWARE-PROGRESS

Trạng thái: **PASS** tại implementation SHA `c0a1fee65fcc66f3e1e4241252b5b1a7cd4645c4`. Independent dashboard review đã **FINAL APPROVE, 0 P0/P1/P2**. Báo cáo được tạo trên docs head `84cbf51e012cb5370fdaaea3a4989d10fc43195a`; không có code hoặc test nào được thay đổi trong lượt tài liệu này.

Dashboard giờ lấy `currentView` và `canSwitchView` từ backend. `SUPER_ADMIN` và `COMPANY_ADMIN` chỉ xem quản lý; `EMPLOYEE` chỉ xem cá nhân; `BOD` và `HR` có thể chuyển giữa hai góc nhìn. Frontend không suy đoán quyền từ role và không render màn quản lý khi server trả payload cá nhân.

Quick check-in chỉ xuất hiện khi có `roadmap:self`. Khi cập nhật task, toàn bộ task trong dialog bị khóa, rapid click bị chặn, request gửi `expectedVersion` và giao diện chờ refetch hoàn tất trước khi mở khóa. Lỗi phiên bản `409` kích hoạt refetch và thông báo dữ liệu đã thay đổi; nếu refresh thất bại, task tiếp tục bị khóa và có thao tác tải lại.

Phần kỹ năng chỉ hiển thị rating đang lưu cùng lời giải thích trung tính. Các khẳng định không có nguồn về Senior, level 4, benchmark nội bộ, khoảng cách năng lực và gợi ý AI đã được bỏ. Switcher dùng `aria-pressed`, vùng chạm `min-h-11`; chỉ số `activeRoadmaps` được ghi nhãn **Tổng lộ trình** vì backend chưa lọc trạng thái active.

## Ma trận role/view

| Vai trò | Mặc định | Góc nhìn được phép | Chuyển góc nhìn | Quick check-in |
|---|---|---|---|---|
| `SUPER_ADMIN` | Quản lý | Quản lý | Không | Không có góc nhìn cá nhân |
| `COMPANY_ADMIN` | Quản lý | Quản lý | Không | Không có góc nhìn cá nhân |
| `BOD` | Cá nhân | Cá nhân, quản lý | Có | Chỉ khi có `roadmap:self` |
| `HR` | Cá nhân | Cá nhân, quản lý | Có | Chỉ khi có `roadmap:self` |
| `EMPLOYEE` | Cá nhân | Cá nhân | Không | Chỉ khi có `roadmap:self` |

## Bằng chứng

- Backend full: **694 passed, 20 skipped trong 71.47s**.
- Ruff: PASS; mypy: PASS trên 90 source files.
- Frontend full: **27 files, 190 tests PASS trong 10.43s**; ESLint và TypeScript PASS.
- Next.js production build: PASS trong 12.45s; **17/17 routes**.
- Independent dashboard review: **FINAL APPROVE, 0 P0/P1/P2**.
- Browser/Playwright/persona/axe/visual regression: **NOT_RUN theo chỉ đạo**.

## Giới hạn

Chưa có bằng chứng trình duyệt cho responsive layout, focus, switcher hoặc luồng 409 thực tế; cũng chưa có axe, visual regression và persona review. Field API vẫn tên `activeRoadmaps` dù đang đếm tổng roadmap để giữ tương thích. Đây chỉ là slice dashboard của W5; Smart People Search, staffing và các phần W5 khác chưa được đánh dấu hoàn tất.

Nguồn chuẩn: `qa-report.json`.
