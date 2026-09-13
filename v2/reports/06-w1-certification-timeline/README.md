# W1-CERTIFICATION-TIMELINE — Báo cáo QA

Xem chi tiết máy-đọc-được tại [`qa-report.json`](./qa-report.json). Bản tóm tắt tiếng Việt bên dưới.

## Phạm vi

Chỉ rà soát **Certification CRUD** và **mốc Certification trong career timeline hợp nhất**,
tương tự task W1-EXPERIENCE-TIMELINE (report 04) và W1-PROJECT-TIMELINE (report 05) nhưng
cho resource kind `certification`. Không đụng tới Experience/Project/Award/Goal/Assessment/
Passport/Staffing — các khu vực đó giữ nguyên trạng thái đã xác minh ở các report trước.

## Kết luận

**Trạng thái: `PASS`.** Review độc lập lần đầu (bên ngoài phiên làm việc này) ra verdict
**REQUEST_CHANGES** với đúng 2 finding P2 (không có P0/P1); reviewer xác nhận tenant/role authz,
optimistic CAS, validate ngày tháng, provenance và audit-log rollback (cả PATCH lẫn DELETE) đều
đúng. Cả 2 finding đã được sửa, và sau đó docs được re-review độc lập thêm 2 vòng nữa để khớp
evidence chính xác với hành vi test thật (không embellishment). Verdict cuối cùng của reviewer
độc lập: **FINAL APPROVE, 0 P0/P1/P2**. Toàn bộ gate không-browser xanh. Thay đổi test đã commit
tại `d258d8759678b0eaaa0b5f4be437989040bdf306` (test-only, tách riêng khỏi commit docs).

Logic sản phẩm cho Certification (backend: `competency_profile_service.py`,
`competency_profile.py`, `competency_schemas.py`; frontend: `profile-view.tsx`) đã đúng từ
trước — Certification dùng chung pipeline generic với Experience/Project/Award nên đã thừa
hưởng: kiểm tra tenant/role qua `resolve_target`, optimistic CAS theo `profileVersion` (409
kèm `currentProfileVersion`), validate `type: CertificationType` + field bắt buộc, validate
quan hệ `issuedAt`/`expiresAt` (bao gồm PATCH kết hợp merge với giá trị hiện có trước khi so
sánh), sort timeline xác định `(-start_date.toordinal(), kind, id)`, loại `issuedAt` null khỏi
timeline. **Không sửa code sản phẩm trong task này** — chỉ bổ sung test còn thiếu.

Khoảng trống ban đầu là **evidence test** — trước task này, Certification chưa có:
- Test vòng đời CRUD đầy đủ + provenance riêng.
- Test tenant-scoping riêng cho endpoint certification.
- Test activity-log rollback khi audit ghi thất bại (cả update lẫn delete).
- Test tie-break thứ tự timeline khi 2 Certification cùng ngày `issuedAt`, và loại trừ
  Certification không có `issuedAt`.
- Test Vitest nào cho luồng UI Certification.

## Thay đổi

- `v2/backend/tests/test_competency_profile_api.py` (mở rộng, +328 dòng net sau khi sửa P2,
  4 test mới): `test_certification_crud_preserves_origin_and_uses_profile_version`,
  `test_certification_tenant_scoping_denies_cross_company_access`,
  `test_certification_timeline_orders_same_issued_at_deterministically_by_id_and_excludes_null`,
  `test_certification_update_and_delete_roll_back_when_audit_fails` (parametrized
  update/delete).
- `v2/frontend/src/features/profile/profile-view.certification.test.tsx` (file mới, 295 dòng,
  5 test): tạo mới, sửa, xóa yêu cầu xác nhận 2 bước, khóa form khi 409 version conflict, và
  reload an toàn sau 409 (không âm thầm gửi lại draft cũ).

## Bằng chứng chạy lại (đã commit tại `d258d8759678b0eaaa0b5f4be437989040bdf306`)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Backend lint | `ruff check .` | All checks passed |
| Backend mypy | `mypy .` | Success, không lỗi (97 file nguồn) |
| Backend test toàn bộ | `CAREERMATE_DEMO_LOGIN_ENABLED=false pytest -q` | 666 passed, 18 skipped |
| Backend test scoped | `pytest -k certification -q` | 6 passed (4 test mới + 1 case parametrize cũ) |
| Frontend test scoped | `npx vitest run .../profile-view.certification.test.tsx` | 5 passed |
| Frontend test toàn bộ | `npx vitest run` | 162 tests passed / 23 file |
| Frontend lint | `npm run lint` | sạch |
| Frontend typecheck | `npm run typecheck` (`tsc --noEmit`) | sạch |
| Frontend build | `npm run build` (`next build --webpack`) | thành công, "Compiled successfully", 17 route |
| `git diff --check` | `git diff --check` | sạch, không output |
| Browser/Playwright/persona | — | **NOT_RUN** theo chỉ đạo tạm dừng của người dùng |

## Finding từ review độc lập (đã sửa, đã re-review — CLOSED)

Reviewer độc lập (bên ngoài phiên làm việc này) review candidate ban đầu của task này và ra
verdict **REQUEST_CHANGES** với đúng 2 finding, cả hai đều P2 (không có P0/P1):

- **P2-1 — test frontend chỉ phủ giá trị mặc định.** Test tạo mới chỉ dùng `type` mặc định
  (`PROFESSIONAL`) nên không chứng minh dropdown loại chứng chỉ thực sự được map vào payload;
  test sửa chỉ đổi `name`, không đổi field nào đặc thù của Certification (`type`/`score`/
  `issuedAt`/`expiresAt`/`credentialUrl`).
  **Sửa:** test tạo mới nay chọn `type = LANGUAGE` (khác mặc định) qua
  `screen.getByLabelText("Loại")` và assert đúng `type: "LANGUAGE"` trong payload gửi đi; test
  sửa nay đổi đồng thời `type` (→ `OTHER`), `score` (890/1000 → 950/1000), `expiresAt`
  (2028-01-01 → 2029-06-01) và `credentialUrl` (→ `credential-v2`) ngoài `name`, và assert cả
  4 giá trị mới trong payload gửi tới `updateProfileResource`.
- **P2-2 — test timeline chỉ kiểm tra thứ tự/loại trừ, không kiểm tra field mapping.** Test
  `test_certification_timeline_orders_same_issued_at_deterministically_by_id_and_excludes_null`
  chỉ assert thứ tự và việc loại `issuedAt = null`, chưa assert từng field chiếu
  (`kind`/`title`/`subtitle`/`startDate`/`endDate`/`sourceType`) của mỗi item timeline.
  **Sửa:** thêm `expiresAt` vào fixture "Alpha Certification" và bổ sung assertion đầy đủ cho
  cả 2 item: `kind == "CERTIFICATION"`, `title` đúng `name`, `subtitle` đúng `issuer`,
  `startDate` đúng `issuedAt`, `endDate` đúng `expiresAt` (hoặc `None` khi không có), `sourceType
  == "SELF"`. Đồng thời sửa fixture frontend `baseProfile().timeline[0].endDate` từ `null`
  thành `"2028-01-01"` để khớp đúng `expiresAt` của certification tương ứng trong fixture (bug
  fixture nội bộ do reviewer chỉ ra kèm P2-2).

Cả hai finding đã được sửa và commit tại `d258d8759678b0eaaa0b5f4be437989040bdf306` (test-only). Toàn bộ gate không-browser
đã chạy lại: backend 666 passed/18 skipped (không mất/trùng test nào so với trước khi sửa),
ruff/mypy sạch, frontend 162 passed/23 file, lint/typecheck/build sạch, `git diff --check` sạch.
Sau đó, docs (evidence trong `qa-report.json`/`README.md`) đã trải qua thêm 2 vòng re-review độc
lập chỉ để khớp chính xác evidence với hành vi test thật (không có finding về code/test). Verdict
cuối cùng của reviewer độc lập: **FINAL APPROVE, 0 P0/P1/P2**. Trạng thái chính thức: `PASS`.

## Giới hạn

Playwright/browser/persona test **không chạy**, theo đúng yêu cầu của task này và chỉ đạo tạm
dừng hiện hành của người dùng. Test code (backend + frontend) đã commit tại `d258d8759678b0eaaa0b5f4be437989040bdf306`; báo cáo
docs này (README.md/qa-report.json/tasks.json/progress.md/handoff.md) được commit riêng, tách
khỏi commit test theo đúng yêu cầu.
