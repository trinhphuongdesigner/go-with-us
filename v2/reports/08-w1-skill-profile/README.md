# W1-SKILL-PROFILE — Báo cáo QA

Trạng thái: **PASS** tại implementation SHA `ac4b1a88b5f18d82ea21e60e4d9cc66d101bed5b`. Reviewer độc lập đã **FINAL APPROVE, 0 P0/P1/P2**; cả bốn P2 vòng đầu đã đóng.

## Ý nghĩa chức năng

- Nhân viên chọn hoặc tạo kỹ năng trong danh mục, tự đánh giá mức 1–5 và ghi chú bối cảnh thực hành.
- Tạo kỹ năng mới bằng catalog POST ghi ngay vào danh mục dùng chung. Chỉ việc thêm/xóa association kỹ năng khỏi hồ sơ, đổi rating và ghi chú mới là bản nháp cho tới khi bấm **Lưu toàn bộ kỹ năng**.
- HR/company admin có quyền phù hợp có thể cập nhật kỹ năng cho nhân viên trong đúng doanh nghiệp; nguồn `SELF`/`ADMIN` và người thao tác được giữ rõ ràng.
- `profileVersion` ngăn hai tab hoặc hai người ghi đè hồ sơ của nhau. Khi có 409, UI khóa bản nháp cũ và yêu cầu tải lại phiên bản mới trước khi lưu tiếp.

## Phạm vi đã xác minh

- Catalog: normalize Unicode/NFC, casefold uniqueness, category, thứ tự và pagination.
- Backend: tenant/role, aggregate/detail scope, SUPER_ADMIN foreign-tenant replace, `SELF`/`ADMIN`, `selfAssessed`, actor và note normalization.
- Full replace: rating nguyên 1–5, duplicate/unknown ID, giới hạn đúng 200, từ chối 201, rollback khi audit log lỗi, CAS 409 và `currentProfileVersion`.
- Frontend: catalog create persist ngay; association add/remove, rating/note giữ draft tới Save; validation, loading/error, pagination trên 200 mục và stale reload dùng phiên bản mới.

## Lỗi sản phẩm đã đóng

Sau khi replace kỹ năng gặp 409, nút **Tải lại hồ sơ** từng remount dữ liệu phiên bản mới nhưng vẫn giữ mutation lỗi cũ, khiến UI tiếp tục hiện cảnh báo “Chưa thể lưu kỹ năng”. Regression test đã chứng minh lỗi; bản sửa gọi `replaceSkills.reset()` sau khi refetch thành công. Test xác nhận draft cũ bị loại, rating/note từ server được hiển thị và lần lưu tiếp theo dùng `profileVersion` mới.

## Bằng chứng trên exact implementation commit

- Backend, từ `v2/backend`: `CAREERMATE_DEMO_LOGIN_ENABLED=false .venv/bin/pytest -q` → **678 passed, 18 skipped in 64.48s**.
- Ruff, từ `v2/backend`: `.venv/bin/ruff check .` → **PASS**.
- mypy, từ `v2/backend`: `.venv/bin/mypy app` → **PASS, 90 source files**.
- Frontend, từ `v2/frontend`: `npm test` → **25 files, 173 tests passed**.
- ESLint: `npm run lint` → **PASS**.
- TypeScript: `npm run typecheck` → **PASS**.
- Next.js: `npm run build` → **PASS, static generation 17/17**.
- Review độc lập: **FINAL APPROVE, 0 P0/P1/P2**; P2-1 đến P2-4 đều **CLOSED**.
- JSON và `git diff --check`: **PASS** sau cập nhật tài liệu.
- Playwright/browser/persona: **NOT_RUN** theo chỉ đạo tạm dừng.

## File implementation và test

- `v2/backend/tests/test_competency_profile_api.py`
- `v2/frontend/src/features/profile/profile-view.skills.test.tsx`
- `v2/frontend/src/features/profile/profile-view.tsx`

Implementation và test đã được lưu riêng tại `ac4b1a88b5f18d82ea21e60e4d9cc66d101bed5b`. `qa-report.json`, README và ledger được chuẩn bị cho một commit tài liệu riêng ngay sau implementation. Các file v1 đã dirty từ trước nằm ngoài phạm vi và không được stage.

## Giới hạn còn mở

- Playwright, browser, persona, accessibility và performance vẫn **NOT_RUN** theo chỉ đạo; báo cáo không diễn giải các gate này là đã chạy.
