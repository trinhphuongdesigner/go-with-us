# W3-ASSESSMENT-APPROVAL-TRANSACTION

Trạng thái slice: **PASS** tại implementation/verification SHA `565ba21060a8bf317ae4298dcf31fddd974134d7`. Supporting bugfix `067eab324ad0672f4e45d3e34e51155f8c0525cc` giữ focus người dùng sau reset Assessment Builder. Independent final review đã **APPROVE, 0 P0/P1/P2**. Toàn Wave 3 vẫn **IN_PROGRESS** vì còn các assessment task khác.

## Luồng nghiệp vụ

- **Phê duyệt:** `SUBMITTED → APPROVED`. Backend kiểm tra tenant, `assessment:review`, cấm self-approval và `expectedVersion`; sau đó tính lại điểm từ immutable `template_snapshot` cùng answers đã lưu, đặt approval metadata và ghi audit.
- **Từ chối:** `SUBMITTED → REJECTED`. Bắt buộc lý do, không đặt approval metadata và là trạng thái terminal, không cho sửa hoặc gửi lại.
- **Yêu cầu chỉnh sửa:** `SUBMITTED → DRAFT`. Bắt buộc lý do, xóa cached scores/approval metadata để reviewer sửa và submit lại. Frontend đã gọi đúng `/request-revision`, không dùng nhầm terminal `/reject`.

Version cũ trả typed `409 {code: version_conflict, currentVersion}`. State không hợp lệ trả typed `409 {code: invalid_state, currentStatus}`. Double approve đồng thời trên PostgreSQL chỉ có một `200`, một typed `409` và đúng một audit row.

Assessment transition, score/approval metadata và activity log nằm trong một transaction. Nếu audit lỗi, toàn bộ thay đổi rollback. Audit chỉ chứa status/version, các ID nghiệp vụ, scores xác định hoặc `reasonProvided`; không ghi answers, comment đánh giá hay nội dung lý do riêng tư.

## Bằng chứng

- PostgreSQL focused: **11 passed**, gồm concurrent double approve qua production row lock.
- Backend full: **729 passed, 21 skipped**.
- Ruff PASS; mypy app **90 source files PASS**.
- Frontend full: **28 files, 191 tests PASS**; ESLint và TypeScript PASS.
- Next.js production build: PASS; **17/17 routes**.
- Independent final review: **APPROVE, 0 P0/P1/P2**.
- Browser/Playwright/persona/axe/visual regression: **NOT_RUN theo chỉ đạo**.
- Provider live: **NOT_RUN**; AI không tham gia scoring hay approval transaction.

## Giới hạn

Chưa có browser evidence cho các nút review, focus thực tế hoặc thông báo typed 409. W3 còn template/cycle/assignment và các flow khác cần kiểm tra theo slice riêng.

Nguồn chuẩn: `qa-report.json`.
