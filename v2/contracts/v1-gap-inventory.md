# CareerMate v1 — Gap inventory (evidence-only)

Tài liệu này ghi lại hành vi đã quan sát trong v1 để hỗ trợ parity và migration. Nó **không phải**
hợp đồng API, role, security hay schema của v2. Quy tắc thực thi Wave 1 nằm duy nhất trong
`wave1-feature-contract.md`.

## 1. Quyết định tương thích đã khóa

- V2 dùng base path `/api/v2`; mọi unversioned API của v1 chỉ là bằng chứng lịch sử.
- V2 chỉ lưu `SUPER_ADMIN`, `COMPANY_ADMIN`, `EMPLOYEE`.
- Persona legacy `HR` và `BOD` được map sang `COMPANY_ADMIN` cùng permission allowlist trong
  migration Wave 6. Wave 1 không tạo enum/role `HR` hoặc `BOD`.
- Wave 1 chỉ gồm Employee 360 và document import. Auth/company/user/employment foundation đã có từ
  Wave 0 và chỉ là dependency.
- V2 nhận PDF, DOCX, ảnh, text, CSV và XLSX qua backend; hành vi v1 chỉ nhận `rawText` không được
  giữ làm contract.
- AI proposal không tự persist và không dùng confidence percentage giả. Selective apply dùng
  transaction, version, idempotency và rollback toàn bộ.

## 2. Phần v1 có thể dùng làm parity reference

Các section dữ liệu hiện có trong v1:

- Profile header và competency aggregate.
- Skill catalog và employee self-assessment.
- Project experience, certification và award.
- Employment history và timeline.
- Profile import proposal gồm profile/job title, skills, certifications, projects, awards và summary.

Primary source trong v1:

- `backend/src/modules/competency-profile/competency-profile.controller.ts`
- `backend/src/modules/competency-profile/competency-profile.service.ts`
- `backend/src/modules/skills-competency/skills-competency.controller.ts`
- `backend/src/modules/skills-competency/skills-competency.service.ts`
- `backend/src/modules/profile-imports/profile-imports.controller.ts`
- `backend/src/modules/profile-imports/profile-imports.service.ts`
- `backend/src/modules/career-passport/career-passport.service.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `docs/careermate-scope.md`
- `docs/careermate-work-split.md`

## 3. Gap bảo mật và tenant đã xác minh

| Mức | Hành vi v1 quan sát được | Quyết định v2 |
|---|---|---|
| Critical | Company hard delete có thể cascade Employment. | Soft archive; giữ lịch sử nghề nghiệp. |
| Critical | Shared public user projection có thể lộ phone, DOB, ID và emergency contact cho peer cùng company. | Projection riêng cho self, roster và admin; data minimization. |
| Critical | Một số permission override hẹp có thể bị role definition `FULL` lấn át. | Permission typed/fail-closed; test effective allowlist. |
| Critical | Import apply ghi nhiều lần và có thể để lại dữ liệu một phần/duplicate khi retry. | One transaction, proposal/profile version, idempotency receipt và provenance unique. |
| High | Company provisioning và role definitions từng nằm ở các commit DB riêng. | Một transaction với rollback fault-injection test. |
| High | Employment create/end có đường đi nhận company tùy ý hoặc cập nhật User/Employment tách rời. | Tenant derive từ identity/resource; row lock và atomic pointer update. |
| High | Project có thể nhận `employmentId` chưa kiểm owner/company. | Validate owner; derive company từ Employment. |
| High | Aggregate có nguy cơ lộ lịch sử company khác sau khi subject được nhìn thấy. | Filter từng row theo tenant và consent scope. |
| High | JWT từng có fallback development secret. | Startup fail nếu thiếu secret. |
| High | Self profile patch từng nhận score/field do admin sở hữu. | Actor-specific field allowlist. |
| Medium | Skill batch từng ghi từng item; normalized uniqueness chưa đủ. | Validate all rồi atomic batch; DB normalized unique key. |
| Medium | `LINKEDIN_URL`/`CV_FILE` của v1 vẫn dựa vào raw text client gửi. | Backend intake thật; LinkedIn chỉ user-provided/export, không crawl. |
| Medium | Thiếu test module độc lập cho nhiều service/controller. | Unit + PostgreSQL integration + HTTP contract + Playwright evidence. |

## 4. Gap import và AI

V1 có proposal/apply nhưng chưa tạo chuỗi provenance bất biến từ tài liệu đến fact. V2 cần
`SourceDocument`, `SourceVersion`, `SourceBlock`, `EvidenceRef`, `ProfileImport`, `ProposedValue`,
`AIInvocation` và idempotency receipt.

Các hành vi v1 không được port nguyên trạng:

- Client tự gửi raw text thay cho pipeline MIME/magic/malware/hash/extraction.
- Trả raw text rộng trong list/detail hoặc ghi raw PII vào log/report.
- Dùng client payload không bind với proposal version.
- AI output có ID không allowlist, evidence offset/hash sai hoặc fact không có nguồn.
- Confidence percentage do model sinh.
- Apply gọi lại AI, tự chọn toàn bộ item hoặc ghi từng resource ở transaction riêng.
- Provider error được thay âm thầm bằng dữ liệu demo không gắn nhãn.

## 5. Gap concurrency và database

- Cột `version` chỉ có ý nghĩa khi update dùng `WHERE version = expectedVersion` hoặc SQLAlchemy
  versioning tương đương; chỉ khai báo cột là chưa đủ.
- Active Employment cần partial unique constraint theo user.
- Skill normalized key, `(userId, skillId)`, `(sourceImportId, proposalItemId)` và idempotency key cần
  unique constraint trong PostgreSQL.
- Parse dùng compare-and-swap để ngăn hai provider call đồng thời.
- Apply khóa import/profile, validate toàn bộ trước write và rollback cả provenance/activity log.
- SQLite không chứng minh được partial index, row lock, isolation hay concurrent conflict; các case
  này phải chạy trên `careermate_v2_test`.

## 6. Parity matrix Wave 1

| Capability | Có trong v1 | V2 cần giữ | V2 cần sửa/thêm |
|---|---:|---:|---|
| Profile aggregate | Có | Có | Snapshot nhất quán và tenant filter từng section. |
| Skill self-assessment | Có | Có | Atomic batch và normalized uniqueness. |
| Experience/project/certification/award | Có | Có | Strict schema, provenance, owner/company checks. |
| Employment timeline | Có | Có | Portable/company projection rõ ràng. |
| Text-based import proposal | Có | Có | Evidence chain và strict AI validation. |
| PDF/DOCX/image/CSV/XLSX intake | Chưa hoàn chỉnh | Có | Backend file pipeline, malware adapter, deterministic parser. |
| Selective apply | Một phần | Có | Review từng field, transaction, version, idempotency. |
| Prompt-injection defense | Chưa đủ evidence | Có | Untrusted document boundary và adversarial tests. |
| Roster/admin view | Một phần | Có | Minimal projection và permission-backed actions. |

## 7. Evidence cần tái kiểm trước khi báo parity

- Đối chiếu route/controller/service v1 với OpenAPI snapshot v2.
- Đối chiếu Prisma entities/relations với migration SQLAlchemy/Alembic v2.
- Chạy negative matrix cho owner, peer, company admin có/không permission, super admin và
  cross-company actor.
- Chứng minh parse không đổi profile và apply fail giữa chừng không để lại row.
- Chứng minh raw binary/PII không xuất hiện trong Git, report, trace hoặc application log.
- Gắn mọi kết quả với cùng implementation SHA và PostgreSQL test database.

Gap inventory này phải được cập nhật bằng evidence mới khi phát hiện khác biệt v1; nó không được
dùng để mở rộng scope hoặc ghi đè `wave1-feature-contract.md`.
