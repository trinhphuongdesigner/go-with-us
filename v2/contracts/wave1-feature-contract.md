# CareerMate v2 — Hợp đồng thực thi Wave 1

Status: **FROZEN**

Scope: **Employee 360 và document import**

Base path: **`/api/v2`**
Nguồn tham chiếu v1: `v1-gap-inventory.md` (evidence-only, không phải hợp đồng)

## 1. Ranh giới Wave 1

Wave 1 chỉ triển khai hồ sơ năng lực 360° và luồng nhập tài liệu có kiểm duyệt. Auth,
company, user, employment, permission, activity log và `AiGateway` từ Wave 0 là dependency;
chỉ được sửa chúng khi cần đóng một lỗi tích hợp đã có test tái hiện.

Assessment, goal/roadmap, passport/offboarding, staffing/search, dashboard mở rộng,
Training/Course Management và đổi toàn bộ theme nằm ngoài Wave 1.

Mọi endpoint mới phải nằm dưới `/api/v2`. JSON dùng camelCase, ID dùng UUID, timestamp dùng
UTC ISO 8601 và request có trường lạ bị từ chối bằng `422`.

## 2. Role, permission và tenant

Chỉ có ba role lưu trong v2:

- `SUPER_ADMIN`: phạm vi toàn nền tảng; không có `companyId`.
- `COMPANY_ADMIN`: luôn gắn với một company đang hoạt động; quyền chi tiết do allowlist backend
  kiểm tra.
- `EMPLOYEE`: self-service và chỉ truy cập dữ liệu cùng tenant theo projection được phép.

`HR` và `BOD` chỉ là persona/nhãn nghiệp vụ của v1. Khi migrate ở Wave 6, cả hai được map thành
`COMPANY_ADMIN` kèm allowlist permission tương ứng; chúng không được tạo thành role hoặc enum mới.
Wave 1 dùng các permission đã typed trong backend, tối thiểu `PEOPLE_READ` và `PEOPLE_WRITE`.
Permission không mở rộng tenant scope. Giá trị role/permission lạ phải fail closed.

Mọi repository query theo nhân sự hoặc tài liệu phải nhận company/owner scope từ identity đã xác
thực hoặc từ resource đã khóa. Không nhận `companyId` do employee truyền để quyết định scope.
Tài nguyên ngoài tenant/owner trả `404` khi việc trả `403` làm lộ sự tồn tại của ID.

## 3. Employee 360

### 3.1 Aggregate và projection

`GET /api/v2/competency-profile?userId=<optional>` trả aggregate:

```json
{
  "user": {},
  "skills": [],
  "experiences": [],
  "projects": [],
  "certifications": [],
  "awards": [],
  "employments": [],
  "timeline": [],
  "version": 1
}
```

Thiếu `userId` nghĩa là self. Aggregate được đọc trong một transaction/snapshot nhất quán.
Timeline sắp xếp ổn định theo ngày giảm dần, sau đó `kind`, rồi ID. Item không có ngày có nghĩa
không xuất hiện trên timeline.

Projection bắt buộc:

- Chủ hồ sơ và `SUPER_ADMIN` được xem lịch sử portable đầy đủ theo policy.
- `COMPANY_ADMIN` có `PEOPLE_READ` chỉ thấy dữ liệu được phép của nhân sự trong company hiện tại;
  lịch sử gắn với company khác bị loại.
- Employee cùng tenant chỉ nhận roster summary tối thiểu; không nhận DOB, điện thoại, emergency
  contact, raw document, secret, token hoặc trường quản trị.
- Self-edit chỉ cho field allowlist; client không được ghi role, company, score xác thực,
  provenance, actor hoặc version.

### 3.2 Resource API

Các API sau đều nằm dưới `/api/v2`, dùng owner/tenant policy chung, optimistic version khi sửa và
ghi activity log cùng transaction:

| Resource | Endpoint chính |
|---|---|
| Skill catalog | `GET/POST /api/v2/skills-competency/skills` |
| Employee skill | `GET /api/v2/skills-competency/users/{userId}`; `PUT /api/v2/skills-competency/users/{userId}/skills` |
| Experience | CRUD `/api/v2/competency-profile/experiences` |
| Project | CRUD `/api/v2/competency-profile/projects` |
| Certification | CRUD `/api/v2/competency-profile/certifications` |
| Award | CRUD `/api/v2/competency-profile/awards` |

Owner được quản lý resource của mình. `COMPANY_ADMIN` cần `PEOPLE_WRITE` và cùng tenant để collect
hoặc sửa. Batch skill phải validate toàn bộ trước lần ghi đầu tiên. Level là số nguyên 1–5.
Skill name được trim, collapse whitespace và case-fold bằng normalized key duy nhất trong DB.

Project/experience gắn `employmentId` phải cùng owner; company được suy ra từ Employment, không
lấy từ body. Ngày kết thúc không được trước ngày bắt đầu. URL chỉ nhận `http`/`https` tuyệt đối.

Mọi resource có provenance do server quản lý:

- `sourceType`: `SELF | ADMIN | IMPORT`.
- `sourceImportId`, `proposalItemId`, `createdBy`, `updatedBy`, timestamps.
- Imported resource có unique `(sourceImportId, proposalItemId)` để retry không tạo bản sao.

## 4. Document intake

### 4.1 Định dạng và kiểm tra

Backend nhận file thật bằng multipart hoặc text có metadata, với allowlist:

- PDF: `application/pdf`.
- DOCX: MIME OpenXML hợp lệ.
- Ảnh: PNG, JPEG và WebP.
- Văn bản: UTF-8 `text/plain`.
- CSV: UTF-8 có parser xác định.
- Excel: XLSX bằng parser xác định; không chạy macro hoặc formula.

Pipeline theo đúng thứ tự:

1. Giới hạn kích thước và số file trước khi đọc toàn bộ vào bộ nhớ.
2. Kiểm extension, declared MIME và magic bytes; mismatch bị từ chối.
3. Quét malware qua adapter. Nếu scanner không sẵn sàng, trạng thái là `BLOCKED`/lỗi rõ ràng;
   không bỏ qua âm thầm.
4. Tính SHA-256 và chống nhập trùng trong owner/company scope.
5. Trích xuất thành `SourceDocument -> SourceVersion -> SourceBlock` có thứ tự và page/sheet.
6. Gắn tài liệu là untrusted content; instruction trong tài liệu không được điều khiển system/tool.
7. Xóa raw binary sau xử lý trừ khi retention policy được cấu hình; report/log không chứa raw PII.

LinkedIn chỉ nhận file export hoặc nội dung người dùng cung cấp. V2 không crawl profile, không dùng
cookie/account browser và không fetch trang authenticated.

### 4.2 State machine và API

| API | Hành vi |
|---|---|
| `POST /api/v2/profile-imports` | Owner upload file/text; tạo source và import `PENDING`, chưa đổi profile. |
| `GET /api/v2/profile-imports` | Danh sách metadata phân trang; không trả raw file/text. |
| `GET /api/v2/profile-imports/{id}` | Detail owner-scoped gồm blocks/proposal cần cho review, có redaction. |
| `POST /api/v2/profile-imports/{id}/parse` | CAS `PENDING|FAILED -> PROCESSING`; AI tạo proposal, không ghi profile entity. |
| `POST /api/v2/profile-imports/{id}/apply` | Nhận lựa chọn đã review, `proposalVersion`, profile `version` và `Idempotency-Key`. |
| `DELETE /api/v2/profile-imports/{id}` | Chỉ trước `APPLIED`; xóa theo retention/provenance policy. |

State hợp lệ: `PENDING -> PROCESSING -> PARSED -> APPLIED`, `PROCESSING -> FAILED`,
`FAILED -> PROCESSING`. Hai parse đồng thời chỉ một request được quyền gọi provider. Không giữ DB
transaction mở trong thời gian gọi AI.

## 5. Proposal, evidence và AI boundary

AI chỉ tạo `ProposedValue`; proposal không tự persist vào hồ sơ. Mỗi fact về nhân sự muốn được
chọn phải có `EvidenceRef` hợp lệ trỏ tới source version/block/page/offset đã allowlist. Server kiểm:

- Pydantic/JSON Schema strict và không có field lạ.
- ID tồn tại, đúng owner/tenant và thuộc allowlist request.
- Quote/offset/hash khớp block sau canonical normalization.
- Enum, date, URL, level, string/array bound và semantic relation.
- Evidence coverage bằng 100% cho fact về nhân sự.

Thiếu nguồn trả `insufficient_evidence`; cần hỏi thêm trả `needs_clarification`; provider lỗi trả
`failed`. Fallback xác định được trả `ok` kèm warning `FALLBACK_USED`; không thêm status ngoài bốn
giá trị `ok | needs_clarification | insufficient_evidence | failed`.

Không sinh hoặc hiển thị phần trăm confidence giả. UI hiển thị nguồn, cảnh báo và trạng thái hỗ trợ.
AI không tính score, không cấp quyền, không chọn tenant, không ghi DB và không được tự tạo dữ kiện
vắng mặt.

## 6. Selective apply

Apply không gọi AI. Trong một transaction với row lock/optimistic check:

1. Xác thực owner, trạng thái `PARSED`, `proposalVersion`, profile `version` và idempotency key.
2. Nếu key đã commit với cùng request digest, trả đúng receipt cũ; cùng key khác payload trả `409`.
3. Validate toàn bộ item đã chọn hoặc chỉnh sửa trước lần ghi đầu tiên.
4. Chỉ apply các field/item người dùng đã chọn; item unsupported không được chọn mặc định.
5. Ghi profile resources, provenance, activity log, receipt và chuyển `APPLIED` cùng transaction.
6. Bất kỳ lỗi nào rollback toàn bộ; không để hồ sơ nửa vời.

Stale version trả `409`. Retry sau `APPLIED` không tạo duplicate. Hai tab apply đồng thời chỉ một
version thắng; tab còn lại nhận conflict và dữ liệu mới để review lại.

## 7. Logging, privacy và provider

OpenTelemetry/log chỉ ghi task, duration, token count, outcome, trace ID, hash/count và metadata
model đã được provider xác minh. Không ghi raw CV, tên nhân viên, assessment, prompt chứa PII,
provider response thô, ciphertext/secret hoặc password/token.

Test dùng synthetic fixture provider; không dùng API key công ty. Provider timeout có bounded retry,
jitter và circuit breaker; lỗi/fallback luôn hiện rõ cho UI.

## 8. Acceptance gate

Wave 1 chỉ PASS khi cùng implementation SHA vượt qua:

- Ruff, mypy, backend unit và PostgreSQL integration trên `careermate_v2_test`.
- Alembic upgrade + drift check cho constraints/provenance/import/idempotency.
- OpenAPI snapshot và generated TypeScript client không drift.
- Frontend lint, typecheck, unit/component và production build.
- Playwright tại `390x844`, `768x1024`, `1440x900`; loading/empty/error, console/network failure.
- Keyboard-only, focus visible, reduced motion và axe accessibility.
- Role matrix, owner/tenant isolation và PII projection.
- Transaction rollback, duplicate upload, concurrent parse/apply, stale version và idempotency replay.
- Malformed/empty/corrupt document, MIME mismatch, malware scanner failure và unsupported file.
- Malformed AI schema, invented ID, invalid/missing evidence, prompt injection, timeout/empty result.
- Parse không đổi profile; apply lỗi không ghi một phần; log không chứa raw PII.
- Review code/security độc lập và persona UX review.
- `v2/reports/01-employee-360-import/qa-report.json`, HTML và Markdown tiếng Việt được sinh từ JSON
  và gắn đúng SHA. `PASS` không được suy ra từ UI, một screenshot, CI đơn lẻ hoặc lời agent.

Ngưỡng bắt buộc: 0 invented ID, 100% fact được apply có evidence, 0 tenant leak, 0 critical/high
security finding. Test SQLite chỉ dùng cho pure/fast unit; constraint, transaction và concurrency
phải chạy PostgreSQL test database.
