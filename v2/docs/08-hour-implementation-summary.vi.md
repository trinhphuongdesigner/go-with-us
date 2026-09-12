# CareerMate v2 — Tổng hợp triển khai 8 giờ

> Đây là snapshot lịch sử tại SHA `6e1eafd`. Candidate hợp nhất hiện tại và các giới hạn mới nhất được ghi tại [consolidation-handoff.vi.md](./consolidation-handoff.vi.md).

Ngày cập nhật: **12/09/2026**

Nhánh tích hợp: **`feat/v2-rebuild`**

Implementation SHA gần nhất: **`6e1eafdb2e4116277e2325ee143d919b3d6aaf2d`**

## 1. Kết quả đã hoàn thành

| Nhóm | Tính năng đã triển khai | Vấn đề được giải quyết |
|---|---|---|
| Nền tảng v2 | FastAPI, PostgreSQL async, SQLAlchemy, Alembic; Next.js 16, React 19 và Tailwind CSS 4 | Tạo codebase v2 độc lập, dễ mở rộng và không phụ thuộc NestJS/MUI |
| Xác thực và phân quyền | Đăng nhập, đăng xuất, current user; `SUPER_ADMIN`, `COMPANY_ADMIN`, `EMPLOYEE`; permission backend | Chặn truy cập trái quyền và truy cập chéo doanh nghiệp |
| AI Gateway | Structured output, schema validation, evidence reference, retry, circuit breaker và deterministic demo | Giảm hallucination; AI không tự ghi dữ liệu vào database |
| Nhập hồ sơ | Nhập tài liệu, phân tích, tạo proposal có nguồn, review và selective apply | Người dùng kiểm soát từng dữ kiện trước khi lưu; lỗi giữa chừng không tạo hồ sơ nửa vời |
| Hồ sơ cá nhân | Xem và sửa hồ sơ, optimistic locking, activity log | Tránh hai tab hoặc hai request ghi đè dữ liệu |
| Danh sách nhân sự | Tìm kiếm, phân trang, xem chi tiết theo permission và tenant | HR/BOD tra cứu nhân sự mà không lộ dữ liệu ngoài phạm vi |
| Hồ sơ năng lực 360° | Skill, Experience, Project, Certification, Award và Employment | Gom thông tin nghề nghiệp thành một aggregate thống nhất |
| Timeline nghề nghiệp | Năm loại sự kiện, bỏ mục không có ngày và sắp xếp ổn định | Tạo lịch sử nghề nghiệp nhất quán để dùng cho profile, roadmap và passport |
| UI/UX | Milo, màu trung tính, form đầy đủ, nhãn tiếng Việt, xác nhận xóa, trạng thái loading/empty/error/stale | Giao diện rõ cho nhân viên, quản lý và người ít sử dụng công nghệ |

## 2. Công nghệ chính

### Backend

- Python 3.12, FastAPI và Pydantic v2.
- SQLAlchemy async, Alembic và PostgreSQL.
- Domain/service/repository boundaries.
- OpenAPI snapshot và TypeScript client được sinh tự động.
- Optimistic locking, transaction, activity log và tenant-scoped query.

### Frontend

- Next.js 16 và React 19.
- Tailwind CSS 4 cùng design tokens CareerMate.
- TanStack Query cho server state.
- React Hook Form/Zod theo kiến trúc đã chọn cho các form tiếp theo.
- Playwright và axe cho responsive, keyboard và accessibility.

### AI reliability

- AI chỉ trả proposal có cấu trúc; không trực tiếp ghi database.
- Dữ kiện nhân sự phải có `EvidenceRef` hợp lệ.
- ID do AI trả về phải nằm trong allowlist của server.
- Provider lỗi hoặc timeout phải trả trạng thái rõ ràng; deterministic fixture chỉ dùng cho demo/test và được gắn nhãn.
- Log không chứa CV thô, prompt có PII hoặc secret.

## 3. Quy tắc và công thức đang áp dụng

### Phiên hồ sơ và cập nhật đồng thời

Mọi thay đổi hồ sơ dùng compare-and-swap:

```text
Cho phép cập nhật khi: version_database = version_client
Sau khi commit:       version_mới = version_database + 1
```

Nếu version không còn khớp, API trả `409` để client tải lại dữ liệu thay vì ghi đè.

### Kỹ năng

- Mức kỹ năng là số nguyên từ **1 đến 5**.
- Tên skill được chuẩn hóa Unicode NFC, trim, collapse whitespace và case-fold.
- Danh sách skill của nhân viên được thay thế nguyên tử trong một transaction.

### Timeline

Timeline chỉ gồm:

```text
EMPLOYMENT | EXPERIENCE | PROJECT | CERTIFICATION | AWARD
```

Quy tắc sắp xếp:

```text
date giảm dần → kind tăng dần → id tăng dần
```

Resource không có ngày sẽ không xuất hiện trên timeline.

### Giới hạn và chất lượng

- Tối đa **200** resource cho mỗi loại trên một hồ sơ; kiểm tra được thực hiện sau khi giữ khóa version.
- Skill catalog dùng phân trang, `pageSize` tối đa **200** và `page` tối đa **10.000**.
- AI evidence coverage mục tiêu: **100%** cho dữ kiện hồ sơ được apply.
- Tenant isolation mục tiêu: **0** truy cập chéo doanh nghiệp.
- Body text đạt contrast tối thiểu **4.5:1**.
- Vùng thao tác chính tối thiểu **44px**.
- LCP mục tiêu dưới **2,5 giây**.

## 4. Công thức Cross Assessment cần giữ cho wave tiếp theo

Cross Assessment chưa được triển khai trong checkpoint này. Công thức dự kiến phải được backend tính từ snapshot bất biến:

```text
Weighted Score = Σ(criterion score × criterion weight) / Σ(criterion weight)
```

Các ràng buộc cần khóa:

- Tổng trọng số trong một nhóm hoặc template phải bằng **100%**.
- Không cho AI tính hoặc sửa điểm.
- AI chỉ tóm tắt nhận xét, giữ lại bất đồng và dẫn nguồn tới assessment.
- Khi approve, score, snapshot, cập nhật hồ sơ và activity log phải commit nguyên tử.
- Template đã dùng trong chu kỳ đánh giá phải được snapshot; chỉnh template sau đó không được thay đổi kết quả cũ.

## 5. Bằng chứng kiểm tra gần nhất

Trên implementation SHA `6e1eafdb2e4116277e2325ee143d919b3d6aaf2d`:

- Backend PostgreSQL: **237 test PASS**.
- Frontend unit/component: **47 test PASS**.
- Playwright và axe: **66 test PASS** tại `390×844`, `768×1024` và `1440×900`.
- Alembic upgrade/drift, Ruff, mypy, ESLint, TypeScript, production build, Bandit, dependency audit, OpenAPI/client và Gitleaks: **PASS**.
- Backend, concurrency và UI/persona review độc lập: **APPROVE**, không còn P0/P1/P2 trong slice competency resources.

## 6. Trạng thái và phần chưa hoàn thành

Đã hoàn thành có báo cáo xác minh:

- Wave 0 — Foundation, Auth và AI boundary.
- Wave 1 — Document import và selective apply nền tảng.
- Wave 1 — Core profile và tenant-scoped roster.
- Wave 1 — Competency resources và unified timeline đã hoàn thành implementation/review; report `03` đang được hoàn thiện.

Chưa hoàn thành:

- Import AI trực tiếp vào đầy đủ skill, experience, project, certification và award với provenance.
- Browser E2E nối frontend với backend thật.
- `Employment.level` và `Employment.department` phục vụ migration parity.
- Goals và Milo Roadmap hoàn chỉnh.
- Cross Assessment.
- Career Passport và offboarding.
- Smart People Search, staffing, dashboard và wellbeing.
- Migration v1 → v2, reconciliation, hardening và cutover runbook.

Toàn bộ CareerMate v2 vẫn ở trạng thái **IN_PROGRESS**. Không dùng kết quả của riêng UI, một agent hoặc một test suite để tuyên bố full rewrite đã hoàn thành.
