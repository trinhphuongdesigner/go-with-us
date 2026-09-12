# Candidate hợp nhất v2 — đợt assembly

Nhánh: `codex/v2-qa-consolidation`. Worktree: `.claude/worktrees/v2-qa`.
**Chưa phải bản bàn giao đầy đủ nghiệp vụ master.** Giữ toàn bộ stack v2; không chạy NestJS/MUI.

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
| Team `origin/master` `8d5eee37` | Nguồn nghiệp vụ cho đợt migration tiếp theo, chưa port trong đợt này |

Snapshot riêng lưu staged/unstaged/untracked + hash tại máy điều phối, ngoài repo; không chứa `.env` thực hoặc `.pi/`. Worktree nguồn không bị xóa/reset/stash. Phiên Anti thiết kế còn chỉ báo trạng thái không xác nhận được; snapshot đã kiểm hash và Git state trước/sau, không sửa nguồn.

## Đã nối trong candidate

- `/cai-dat`: ba preset sáng; nhân viên preview/apply/cancel/restore; giới hạn role theo feature nguồn hiện tại, chưa mở rộng HR/BOD.
- `/cong-ty` → `/cong-ty/tieu-chi/preview`: builder có nhãn bản nháp trong bộ nhớ, không báo lưu/publish backend.
- `/nhan-su` → `/nhan-su/tim-kiem`: UI search và endpoint `POST /api/v2/people-search/query` trên app chính.
- Giữ wiring `/ho-so`, `/nhan-su`, force states và company scope của nền mới; giữ nhãn dữ liệu minh họa và label mobile không bị cắt.
- Gateway giữ nguyên `ProposedValue`/`SupportStatus` của profile import mới; chỉ task intent không cần bằng chứng về người. Các task khác vẫn bắt buộc evidence.
- OpenAPI và TypeScript generated được cập nhật cùng router.

## Giới hạn cần tester biết

| Nhóm | Trạng thái |
|---|---|
| Theme | Tính năng local đã ghép; chưa đồng bộ server |
| Profile/resources | API/CRUD đã có từ nền; UI demo dùng fixture khi bật DEMO_MODE |
| Builder | DEMO: bản nháp mất khi tải lại, chưa publish/lưu server |
| Search | PARTIAL: intent cần Madison; catalog/repository verified chưa nối, phải báo thiếu bằng chứng. Super admin chưa có chọn company cho endpoint search |
| Role/layout team | PENDING: candidate hiện vẫn 3 role của v2, chưa 5 role và sidebar hai tầng |
| Profile import/avatar/evidence/HR mới | PENDING migration nghiệp vụ team |
| Roadmap team | PENDING persistence/AI thật/multiple attempts; roadmap v2 hiện localStorage |
| Company-scoped approvals/assessments team | MOCK upstream, không tự xem là backend đã làm |

## Chạy UI kiểm tra assembly

Từ `v2/frontend` trong worktree QA:

```sh
npm ci
NEXT_PUBLIC_DEMO_MODE=true npm run dev -- --hostname 127.0.0.1 --port 3140
```

Mở `http://127.0.0.1:3140/login`, chọn vai trò minh họa. Đây là **UI demo**, không phải kiểm tra database thật. Không gọi search bằng demo token rồi coi là lỗi auth production: token minh họa không phải token backend.

## Chạy với API thật khi có cấu hình QA

Backend dùng `uv.lock` và Python 3.12:

```sh
uv sync --locked
uv run uvicorn app.main:app --host 127.0.0.1 --port 8140
```

Trước khi chạy cần thiết lập `.env` riêng không commit: `CAREERMATE_DATABASE_URL` trỏ DB QA đã migrate, `CAREERMATE_JWT_SECRET`, `CAREERMATE_CORS_ORIGINS=http://127.0.0.1:3140`; seed chỉ dữ liệu synthetic theo script hiện có. Không dùng DB/team credentials của source cũ hoặc database production. Madison dùng `CAREERMATE_MADISON_API_KEY`, `CAREERMATE_MADISON_BASE_URL`, `CAREERMATE_MADISON_MODEL`; không paste giá trị vào report.

Frontend API thật: `NEXT_PUBLIC_DEMO_MODE=false NEXT_PUBLIC_API_URL=http://127.0.0.1:8140/api/v2`. Nếu chạy production, các biến public phải đặt lúc build và cần rebuild sau khi chuyển mode. Chỉ chạy khi cổng trống; không dừng server không thuộc candidate.

## Kiểm tra đợt assembly

- Nền trước chỉnh: 47 frontend tests; 14 backend tests profile/permissions.
- Sau ghép: 128 frontend tests, typecheck và lint qua.
- 90 backend tests tập trung: app composition/auth, intent policy, canonical service/router, AI gateway qua; không gọi provider thật.
- Build và browser smoke được ghi trong checkpoint ngoài repo theo SHA sau commit; không lấy kết quả worktree cũ làm chứng cứ candidate.
- Browser smoke demo chỉ chứng minh UI/wiring; không chứng minh migration master hoàn tất hay workflow backend đầy đủ.

## Đợt tiếp theo

Port role/tenant contract trước, rồi profile/upload/import/HR và roadmap persisted theo nghiệp vụ team. Chưa tự quyết WORK/PERSONAL vì upstream schema và UI mâu thuẫn; đang hỏi user. Giữ request gửi đích danh HR, proposal-before-apply, và lịch sử structured roadmap; không gộp nút khác ý nghĩa. Tester handoff đầy đủ chỉ sau runtime nghiệp vụ được nối và kiểm tra.
