# W1-PROJECT-TIMELINE — Báo cáo QA

Xem chi tiết máy-đọc-được tại [`qa-report.json`](./qa-report.json). Bản tóm tắt tiếng Việt bên dưới.

## Phạm vi

Chỉ rà soát **Project CRUD** và **mốc Project trong career timeline hợp nhất**, tương tự
task W1-EXPERIENCE-TIMELINE (report 04) nhưng cho resource kind `project`. Không đụng tới
Experience/Certification/Award/Goal/Assessment/Passport/Staffing — các khu vực đó giữ
nguyên trạng thái đã xác minh ở các report trước.

## Kết luận

**PASS.** Review độc lập lần đầu (base `65507c6`) ra REQUEST_CHANGES với 2 finding thực sự; cả 2 đã được sửa tại `f845494ef9939a6bf574fc74fb379003b3d68abf` và reviewer độc lập re-review xác nhận CLOSED — xem "Finding từ review độc lập" bên dưới.

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

## Bằng chứng chạy lại (exact SHA `f845494ef9939a6bf574fc74fb379003b3d68abf`)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Backend lint | `ruff check tests/test_competency_profile_api.py` | All checks passed |
| Backend test toàn bộ | `pytest -q` | 661 passed, 18 skipped (baseline 656 passed) |
| Backend test scoped | `pytest tests/test_competency_profile_api.py -q` | 22 passed, 9 skipped |
| Frontend test scoped | `vitest run .../profile-view.project.test.tsx` | 5 passed |
| Frontend test toàn bộ | `vitest run` | 157 passed / 22 file (baseline 152/21) |
| Frontend lint | `npm run lint` | sạch |
| Frontend typecheck | `npm run typecheck` | sạch |
| Frontend build | `npm run build` | thành công, 20 route |

## Finding từ review độc lập (đã sửa)

Reviewer độc lập (bên ngoài phiên làm việc này) review base `65507c6` và ra verdict
**REQUEST_CHANGES** với đúng 2 finding:

- **P1 — stale draft có thể ghi đè thay đổi mới trên server.** `ProfileResourceEditForm`
  seed draft từ `resource`/`profileVersion` qua `useState` một lần khi mount, không bị
  remount/rekey khi profile được reload. Sau một xung đột 409, `reloadProfile()` cập nhật
  lại `profile` nhưng không đóng editor đang mở và không remount form — người dùng có thể
  bấm lưu lại với draft cũ, gửi kèm `profileVersion` mới, âm thầm ghi đè các trường đã bị
  người khác thay đổi trên server thay vì được cảnh báo xung đột.
  **Sửa:** `reloadProfile()` gọi thêm `setEditingResourceId(null)` để đóng mọi editor đang
  mở khi reload; `ProfileResourceEditForm` được gắn
  ``key={`${resource.id}:${profile.profileVersion}`}`` để remount với dữ liệu server mới
  nhất mỗi khi `profileVersion` đổi. Đã thêm test hồi quy trong
  `profile-view.project.test.tsx`, xác minh test **fail khi chưa sửa** (draft cũ vẫn được
  gửi lại) và **pass khi đã sửa**.
- **P2 — test rollback chỉ phủ nhánh update, thiếu delete.**
  `test_project_update_and_delete_roll_back_when_audit_fails` trước đó chỉ gọi PATCH, chưa
  thực sự kiểm tra rollback khi audit-log ghi thất bại trong nhánh DELETE, dù tên test ngụ ý
  phủ cả hai. **Sửa:** parametrize test theo `["update", "delete"]`, giống pattern của test
  rollback generic cho resource khác trong cùng file — cả hai case đều pass.

Cả hai finding đã được sửa tại commit
`f845494ef9939a6bf574fc74fb379003b3d68abf`. Reviewer độc lập re-review đúng nội dung fix,
xác nhận **CLOSED**, không còn P0/P1/P2, `git diff --check` sạch.

## Giới hạn

Playwright/browser/persona test **không chạy**, theo đúng yêu cầu của task này và chỉ đạo
tạm dừng hiện hành của người dùng.
