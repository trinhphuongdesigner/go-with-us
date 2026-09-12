# Candidate hợp nhất v2 — bàn giao QC sớm

Nhánh: `codex/v2-qa-consolidation`. Worktree: `.claude/worktrees/v2-qa`.
**Chưa phải bản bàn giao đầy đủ nghiệp vụ master.** Giữ toàn bộ stack v2; không chạy NestJS/MUI.

`origin/master` mới nhất tại `8d5eee37` đã được merge vào candidate bằng commit `be93e4b`.
Tài liệu bàn giao và ma trận migrate hiện tại: [docs/consolidation-handoff.vi.md](./docs/consolidation-handoff.vi.md).

## Nguồn và xử lý

| Nguồn | Quyết định |
|---|---|
| Integration `6e1eafd` | Nền auth/tenant/profile/resources/timeline |
| Profile resources `c6dc00e` | Cùng tree với nền; không nhập lại |
| Appearance `a407f92` + snapshot chưa commit | Nhập theme Bright Milo/Sky/Violet, settings và kiểm thử |
| Builder `5d034e4` + snapshot chưa commit | Nhập editor/preview và correction đã có |
| People search `5d034e4` + snapshot chưa commit | Nhập feature; mount router trong FastAPI chính, thêm task intent vào gateway |
| Core profile `2c75a37`, UI `6590f43` | Không có delta tính năng còn thiếu được xác định; nền mới hơn đã thay thế, không nhập code cũ |
| Frontend foundation `48afb1b` | Đã được thay thế bởi integration |
| Root dirty `master` | Giữ nguyên; không overlay prototype hay phục hồi component đã bị upstream xóa |
| Team `origin/master` `8d5eee37` | Đã port 5 role, scope layout và phần roadmap persistence; các khoảng trống còn lại ở bảng dưới |

Các asset Milo/An mới trên `origin/master` đã được copy vào `v2/frontend/public/brand/` và khai báo trong manifest để team có thể dùng mà không kéo asset từ frontend v1.

Snapshot riêng lưu staged/unstaged/untracked + hash tại máy điều phối, ngoài repo; không chứa `.env` thực hoặc `.pi/`. Worktree nguồn không bị xóa/reset/stash. Phiên Anti thiết kế còn chỉ báo trạng thái không xác nhận được; snapshot đã kiểm hash và Git state trước/sau, không sửa nguồn.

## Đã nối trong candidate

- `/cai-dat`: ba preset sáng; EMPLOYEE/HR/BOD preview/apply/cancel/restore; lưu trên trình duyệt theo tài khoản.
- `/cong-ty` → `/cong-ty/tieu-chi/preview`: builder có nhãn bản nháp trong bộ nhớ, không báo lưu/publish backend.
- `/nhan-su` → `/nhan-su/tim-kiem`: UI search và endpoint `POST /api/v2/people-search/query` trên app chính.
- Giữ wiring `/ho-so`, `/nhan-su`, force states và company scope của nền mới; giữ nhãn dữ liệu minh họa và label mobile không bị cắt.
- Gateway giữ nguyên `ProposedValue`/`SupportStatus` của profile import mới; chỉ task intent không cần bằng chứng về người. Các task khác vẫn bắt buộc evidence.
- OpenAPI và TypeScript generated được cập nhật cùng router.
- 5 vai trò: SUPER_ADMIN → COMPANY_ADMIN → BOD → HR → EMPLOYEE; BOD/HR có không gian cá nhân và quyền quản trị được cấp rõ ràng. Super admin chọn công ty để vào sidebar tầng hai, không dựng trang nghiệp vụ giả.
- `/lo-trinh` ở chế độ API thật: giữ **Công việc / Cá nhân**, tạo nhiều lộ trình, chặng/việc/ngày dự kiến, lưu có chống trùng retry, đánh dấu hoàn thành có kiểm version, cài đặt hiển thị lưu riêng. Demo vẫn được gắn nhãn và không giả token backend.
- Migrations `0009_role_hierarchy` và `0010_development_plans`; FastAPI là backend duy nhất của gói chạy QC.

## Giới hạn cần tester biết

| Nhóm | Trạng thái |
|---|---|
| Theme | Tính năng local đã ghép; chưa đồng bộ server |
| Profile/resources | API/CRUD đã có từ nền; UI demo dùng fixture khi bật DEMO_MODE |
| Builder | DEMO: bản nháp mất khi tải lại, chưa publish/lưu server |
| Search | PARTIAL: intent cần Madison; catalog/repository verified chưa nối, phải báo thiếu bằng chứng. Super admin chưa có chọn company cho endpoint search |
| Role/layout team | INTEGRATED: 5 role, permissions và sidebar scope theo công ty; không có đầy đủ CRUD quản trị trong UI |
| Profile import/avatar/evidence/HR mới | PARTIAL: giữ flow import v2 và profile resources; avatar, evidence storage, rich-import refine và HR inbox/outbox của team chưa port |
| Roadmap team | PARTIAL: categories/persistence/multiple attempts/task completion/settings đã nối; AI generation, Markdown history, liên kết mục tiêu và sửa cấu trúc sau Save chưa port |
| Dashboard | Dữ liệu mẫu/foundation còn tồn tại; chưa migrate cách tổng hợp mới của team, không dùng các số hiển thị làm tiêu chí dữ liệu thật |
| Company-scoped approvals/assessments team | MOCK upstream, không tự xem là backend đã làm |

## Chạy UI kiểm tra assembly

Từ `v2/frontend` trong worktree QA:

```sh
npm ci
NEXT_PUBLIC_DEMO_MODE=true npm run dev -- --hostname 127.0.0.1 --port 3140
```

Mở `http://127.0.0.1:3140/login`, chọn vai trò minh họa. Đây là **UI demo**, không phải kiểm tra database thật. Không gọi search bằng demo token rồi coi là lỗi auth production: token minh họa không phải token backend.

## Chạy API thật cho QC

Ưu tiên [QC-QUICKSTART.md](./QC-QUICKSTART.md): `bash v2/scripts/qc.sh up` tự build Docker, migrate database QA riêng, seed dữ liệu tổng hợp rồi mở frontend/API. Không dùng DB cũ, không xóa volume khi chạy lại. Frontend Docker build với `NEXT_PUBLIC_DEMO_MODE=false`.

### Chạy tay (tùy chọn)

Backend dùng `uv.lock` và Python 3.12:

```sh
uv sync --locked
uv run uvicorn app.main:app --host 127.0.0.1 --port 8140
```

Trước khi chạy cần thiết lập `.env` riêng không commit: `CAREERMATE_DATABASE_URL` trỏ DB QA đã migrate, `CAREERMATE_JWT_SECRET`, `CAREERMATE_CORS_ORIGINS=http://127.0.0.1:3140`; seed chỉ dữ liệu synthetic. Không dùng DB/team credentials của source cũ hoặc database production. Gói QC không cấu hình AI provider hay antivirus: import có thể dừng an toàn khi dependency thiếu; search không được coi là ranking thật. Không đưa secret vào report.

Frontend API thật: `NEXT_PUBLIC_DEMO_MODE=false NEXT_PUBLIC_API_URL=http://127.0.0.1:8140/api/v2`. Nếu chạy production, các biến public phải đặt lúc build và cần rebuild sau khi chuyển mode. Chỉ chạy khi cổng trống; không dừng server không thuộc candidate.

## Kiểm tra đợt assembly

- Nền trước chỉnh: 47 frontend tests; 14 backend tests profile/permissions.
- Sau ghép: 128 frontend tests, typecheck và lint qua.
- 90 backend tests tập trung: app composition/auth, intent policy, canonical service/router, AI gateway qua; không gọi provider thật.
- Build và browser smoke được ghi trong checkpoint ngoài repo theo SHA sau commit; không lấy kết quả worktree cũ làm chứng cứ candidate.
- Browser smoke demo chỉ chứng minh UI/wiring; không chứng minh migration master hoàn tất hay workflow backend đầy đủ.

## Mức xác nhận của lần bàn giao sớm

Sau yêu cầu tăng tốc của user, **không chạy thêm suite test, vòng review hay browser QA cho batch role/roadmap mới**. Production frontend build (bao gồm TypeScript) đã qua với API thật; đây không phải chứng nhận regression/E2E. Các kết quả test ở trên và của agent là checkpoint trước yêu cầu giảm test, không thay thế kiểm thử của QC trên bản cuối.

QC cần tập trung: đăng nhập 5 vai trò; company scope; CRUD hồ sơ; chuyển WORK/PERSONAL; tạo/lưu/reload lộ trình; completion; theme; chặn truy cập sai quyền. Những phần PARTIAL/PENDING không được ghi PASS chỉ vì có nút hoặc route.

## Đợt tiếp theo (chưa làm trong bàn giao gấp này)

Tiếp tục avatar/evidence/import refine/HR request, AI roadmap + history + liên kết mục tiêu, dashboard thật. User đã chốt giữ WORK/PERSONAL và contract đã đồng nhất. Giữ request gửi đích danh HR và proposal-before-apply; không tự nâng quyền hay gộp nút khác ý nghĩa. Không tuyên bố đã migrate toàn bộ master.
