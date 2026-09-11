# CareerMate v2 — Hợp đồng Wave 1

## Nguyên tắc bắt buộc

- Mọi endpoint v2 nằm dưới `/api/v2` và dùng JSON camelCase.
- ID là UUID, timestamp là UTC ISO 8601.
- Ba role chuẩn: `SUPER_ADMIN`, `COMPANY_ADMIN`, `EMPLOYEE`.
- Quyền quản trị chi tiết là allowlist do backend kiểm tra. Quyền không bao giờ mở rộng
  tenant scope.
- `SUPER_ADMIN` không có `companyId`; hai role còn lại chỉ truy cập tenant đang hoạt động.
- Mọi query dữ liệu doanh nghiệp phải nhận `companyId` từ identity đã xác thực hoặc từ
  resource đã khóa. Không nhận tenant scope từ request của người dùng thường.
- Mutation quan trọng và activity log dùng cùng transaction.
- Collection phải phân trang; response roster không chứa dữ liệu riêng tư không cần thiết.

## Auth và tenant foundation

| API | Hành vi |
|---|---|
| `POST /api/v2/auth/login` | Nhận `{email,password}`, chuẩn hóa email, trả access token và user hiện tại. Sai email hoặc password trả cùng một lỗi 401. |
| `POST /api/v2/auth/logout` | Ghi activity log; client xóa access token. Token revocation/refresh nằm trong hardening backlog. |
| `GET /api/v2/auth/me` | Đọc lại role, tenant, quyền và trạng thái hiện tại từ database. |

JWT chỉ chứa identity và metadata chuẩn (`sub`, `iat`, `exp`, `iss`, `aud`, `jti`).
`CAREERMATE_JWT_SECRET` là cấu hình bắt buộc, tối thiểu 32 ký tự. Password mới dùng
Argon2id; bcrypt v1 chỉ được chấp nhận khi login và được rehash ngay trong transaction.

## Company, employee và employment

- Company archive mềm; không cascade-delete lịch sử nghề nghiệp.
- Company admin chỉ thao tác nhân sự cùng company khi có permission tương ứng.
- Employee xem và sửa các trường cá nhân được allowlist; không tự sửa role, điểm đánh giá,
  xác thực hay tenant.
- Một user có tối đa một employment `ACTIVE`; thay đổi employment và `User.companyId`
  phải nguyên tử và dùng optimistic/pessimistic conflict handling.
- Activity log chứa actor, company scope, entity, request ID, timestamp và tên trường đổi;
  không chứa password, token, raw CV hoặc provider secret.

## Employee 360 và import

- Aggregate gồm hồ sơ, skill, experience/project, certificate, award, employment và timeline.
- Admin company chỉ thấy dữ liệu thuộc tenant của mình; lịch sử portable đầy đủ dành cho chủ
  hồ sơ, super admin hoặc passport share có consent.
- Import nhận PDF, DOCX, ảnh, văn bản, CSV và Excel qua pipeline kiểm MIME/size/malware/hash.
- LinkedIn chỉ nhận nội dung user cung cấp hoặc file export; không crawl tài khoản.
- Parse chỉ tạo proposal có `EvidenceRef`; không ghi domain entities.
- Apply nhận version, idempotency key và lựa chọn đã review; toàn bộ ghi dữ liệu chạy trong
  một transaction. Retry trả cùng kết quả, lỗi không để lại hồ sơ nửa vời.

## Test chấp nhận tối thiểu

- Startup fail khi thiếu JWT secret.
- Login JSON, generic 401, inactive user/company, bcrypt rehash.
- Bảng role/permission và cross-company isolation ở repository lẫn API.
- Rollback company provisioning, employee creation và import apply.
- Concurrent active employment, duplicate normalized email/skill, stale version.
- Import malformed/empty/duplicate, prompt injection, invalid evidence/ID, timeout và
  proposal không tự persist.
