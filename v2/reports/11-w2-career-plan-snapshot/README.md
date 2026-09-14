# W2-CAREER-PLAN-SNAPSHOT

Trạng thái: **PASS** tại implementation SHA `528900a9a773d9d0f3533674b8f6cd75eb29b204`.

Slice này ngăn bản nháp kế hoạch ghép nội dung cũ với `expectedVersion` mới khi React Query cache đổi trong lúc người dùng đang soạn. `CareerPlanPanel` chụp nội dung, tóm tắt, nguồn AI, category và version tại lúc mở draft hoặc nhận proposal; PUT chỉ dùng snapshot đó.

Khi server trả `409 version_conflict`, giao diện giữ bản nháp, chờ refetch active history bằng `throwOnError`, khóa Lưu/Bỏ draft trong lúc phục hồi và báo riêng trường hợp tải lại thành công hoặc thất bại. Người dùng bỏ draft rồi mở lại sẽ lấy version vừa refetch.

## Bằng chứng

- Independent review: **FINAL APPROVE, 0 P0/P1/P2**; 3 P2 vòng đầu đều CLOSED.
- PostgreSQL focused: **3 passed trong 2.00s**, gồm hai writer cùng owner/category.
- Backend SQLite full: **682 passed, 20 skipped trong 83.97s**.
- Ruff: PASS; mypy: PASS trên 90 source files.
- Frontend: **25 files, 181 tests PASS**; ESLint, TypeScript và Next build PASS; static generation 17/17.
- Browser/Playwright/persona: NOT_RUN theo chỉ đạo.

Nguồn chuẩn: `qa-report.json`.
