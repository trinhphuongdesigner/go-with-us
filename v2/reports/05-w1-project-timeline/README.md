# W1-PROJECT-TIMELINE — Báo cáo QA

Xem chi tiết máy-đọc-được tại [`qa-report.json`](./qa-report.json). Bản tóm tắt tiếng Việt bên dưới.

## Phạm vi

Chỉ rà soát **Project CRUD** và **mốc Project trong career timeline hợp nhất**, tương tự
task W1-EXPERIENCE-TIMELINE (report 04) nhưng cho resource kind `project`. Không đụng tới
Experience/Certification/Award/Goal/Assessment/Passport/Staffing — các khu vực đó giữ
nguyên trạng thái đã xác minh ở các report trước.

## Kết luận

**PASS** (kèm 1 giới hạn đã ghi nhận minh bạch — xem "Giới hạn" bên dưới).

Logic sản phẩm cho Project (backend: `competency_profile_service.py`,
`competency_profile.py`, `competency_schemas.py`; frontend: `profile-view.tsx`) đã đúng
từ trước — Project dùng chung pipeline generic với Experience/Certification/Award nên đã
thừa hưởng: kiểm tra tenant/role qua `resolve_target`, optimistic CAS theo
`profileVersion` (409 kèm `currentProfileVersion`), validate ngày tháng
(`endDate >= startDate`), validate/dedupe `techStack` cả trên Create lẫn Patch, sort
timeline xác định `(-start_date, kind, id)`. **Không sửa code sản phẩm.**

Khoảng trống duy nhất là **evidence test** — trước task này, Project chưa có:
- Test vòng đời CRUD đầy đủ + provenance riêng (chỉ có Experience/Award làm đại diện).
- Test tenant-scoping riêng cho endpoint `/projects`.
- Test activity-log rollback khi audit ghi thất bại giữa update/delete.
- Test tie-break thứ tự timeline khi 2 Project cùng ngày bắt đầu.
- Test Vitest nào cho luồng UI Project (fixture cũ khai `projects: []` rỗng).

## Thay đổi

- `v2/backend/tests/test_competency_profile_api.py` (mở rộng, +276 dòng, 4 test mới):
  `test_project_crud_preserves_origin_and_uses_profile_version`,
  `test_project_tenant_scoping_denies_cross_company_access`,
  `test_project_timeline_orders_same_day_entries_deterministically_by_id`,
  `test_project_update_and_delete_roll_back_when_audit_fails`.
- `v2/frontend/src/features/profile/profile-view.project.test.tsx` (file mới, 4 test):
  tạo mới (kèm `techStack` tách theo dấu phẩy), sửa, xóa yêu cầu xác nhận 2 bước, khóa
  form khi 409 version conflict.

## Bằng chứng chạy lại (exact SHA `107c2ae956e9e333a918fa59fea7979e609e0bc8`)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Backend lint | `ruff check tests/test_competency_profile_api.py` | All checks passed |
| Backend test toàn bộ | `pytest -q` | 660 passed, 18 skipped (baseline 656 passed) |
| Backend test scoped | `pytest tests/test_competency_profile_api.py -q` | 22 passed, 9 skipped |
| Frontend test scoped | `vitest run .../profile-view.project.test.tsx` | 4 passed |
| Frontend test toàn bộ | `vitest run` | 156 passed / 22 file (baseline 152/21) |
| Frontend lint | `npm run lint` | sạch |
| Frontend typecheck | `npm run typecheck` | sạch |
| Frontend build | `npm run build` | thành công, 20 route |

## Giới hạn

Công cụ delegate subagent (Task) **không khả dụng** trong phiên làm việc này (trả về
"currently unavailable"). Vì vậy bước "review độc lập" theo yêu cầu task được thay bằng
self-review nghiêm ngặt: đối chiếu từng acceptance criterion với code thực tế theo dòng,
cộng bằng chứng khách quan là kết quả chạy lại toàn bộ test/lint/typecheck/build. Đây
**không phải** một review độc lập thật sự bởi bên thứ hai — khuyến nghị chạy lại một lượt
review bằng Task/code-reviewer khi công cụ khả dụng trở lại, trước khi coi slice này là
đã qua đầy đủ quy trình QA hai lớp như report 04.

Playwright/browser/persona test **không chạy**, theo đúng yêu cầu của task này và chỉ đạo
tạm dừng hiện hành của người dùng.
