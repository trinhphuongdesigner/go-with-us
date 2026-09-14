# W1-AWARD-TIMELINE — Báo cáo QA

Chi tiết máy đọc được nằm tại [`qa-report.json`](./qa-report.json).

## Trạng thái

**`PASS`** tại implementation/test commit
`4c994e02192e104ccf1aeffddb740237e81dfa39`. Reviewer độc lập final **APPROVE**, không còn
P0/P1/P2. Năm file docs/ledger được lưu bằng commit tài liệu riêng ngay sau implementation;
report tiếp tục ghim SHA đã chạy test. Những file v1 ở root đã dirty từ trước vẫn ngoài phạm vi
và không được stage.

Logic sản phẩm Award dùng pipeline resource chung đã có. Slice này bổ sung evidence còn thiếu:

- Award CRUD với `WORK`/`PERSONAL`, mapping `description`, `evidenceUrl`, `awardedAt`.
- CAS `profileVersion` ở stale create, update và delete, trả `currentProfileVersion`.
- Tenant/permission, required fields `name`/`type`/`issuer`, provenance `SELF`/`ADMIN` và
  `selfReported`.
- Rollback update/delete nếu activity log thất bại.
- Timeline deterministic khi trùng `awardedAt`, loại Award không có ngày, mapping đầy đủ.
- Frontend create/edit/delete/409/reload-safe với 5 test.

Không sửa code sản phẩm vì focused tests không phát hiện regression. Test frontend do Pi tạo đã
được bổ sung mock ổn định qua invalidate/refetch và chờ trạng thái lưu thành công.

## Bằng chứng trên exact implementation commit

| Gate | Kết quả |
|---|---|
| Backend full suite, demo login tắt | 673 passed, 18 skipped trong 89.29s |
| Ruff | PASS |
| mypy | PASS, 90 source files |
| Frontend full Vitest | 24 files, 167 tests PASS |
| ESLint | PASS |
| TypeScript `tsc --noEmit` | PASS |
| Next production build | PASS, 17 pages/routes |
| Review độc lập | FINAL APPROVE, 0 P0/P1/P2 |
| `git diff --check` cho docs working tree | PASS |
| Playwright/browser/persona | NOT_RUN theo chỉ đạo |

Ba finding P2 đều đã đóng: mock reload giữ profile mới qua invalidate/refetch; test edit thay đổi
thật `issuer` và `awardedAt`; report/ledger phân biệt rõ slice `v2/` với root v1 dirty từ trước.
