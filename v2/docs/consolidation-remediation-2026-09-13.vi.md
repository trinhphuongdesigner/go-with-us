# CareerMate v2 — Báo cáo remediation candidate hợp nhất

- Thời điểm cập nhật: 2026-09-13 10:23 ICT
- Worktree: `.claude/worktrees/v2-qa`
- Branch: `codex/v2-qa-consolidation`
- Implementation SHA: `f5d7fb093f0cd7f577131111222bcd2d8a43459c`
- Trạng thái: **READY_FOR_MANUAL_TEST_WITH_LIMITATIONS**
- Lưu ý: source/backend/frontend/contracts đã sạch và gắn với SHA trên. Playwright chưa chạy theo yêu cầu tạm dừng; report/orchestration được commit riêng sau implementation.

## Phần đã khép trong lượt remediation

### Mục tiêu và cập nhật đồng thời

- PATCH mục tiêu là partial thật sự; trường không gửi lên được giữ nguyên.
- PATCH và DELETE đều kiểm tra `version` trong câu lệnh SQL theo owner và company.
- Frontend chụp version tại thời điểm mở editor/hộp xác nhận. Một tab cũ nhận 409 thay vì ghi đè hoặc xóa dữ liệu mới.

### Offboarding và Career Passport

- AI không còn được tạo năm điểm năng lực chính thức.
- HR gắn tùy chọn `passportDimension` cho từng nhóm tiêu chí: chuyên cần, chủ động, kiến thức, kỹ năng hoặc đóng góp/hoạt động.
- Chỉ assessment `APPROVED`, đúng user/company/employment và snapshot có mapping rõ mới được tính.
- Dimension không có mapping được bỏ trống; không dùng điểm mặc định hoặc suy diễn.
- Nội dung AI dùng claim có `evidenceRefs`; citation thiếu hoặc assessment ID ngoài allowlist trả 502 và không ghi bản tổng kết.
- Tên người, email, công ty và tên dự án được pseudonymize trước khi gửi provider.
- Context công khai không chứa answer, template snapshot, nhận xét cá nhân hoặc review comment.
- Người duyệt thấy nội dung, điểm mạnh, hướng phát triển và điểm năng lực trước nút đóng băng.

### Smart staffing

- Kỹ năng của tối đa 200 candidate được tải bằng một batch query.
- Ứng viên thiếu bất kỳ kỹ năng bắt buộc nào bị loại trước khi gọi AI.
- Backend tính điểm và sắp hạng. AI chỉ giải thích candidate đã được backend duyệt và phải dẫn skill ID thuộc candidate đó.
- Candidate/skill ID lạ hoặc AI cố thay contract bị từ chối toàn bộ.
- Summary kết quả do backend tạo từ số candidate hợp lệ.

### AI và tìm kiếm có dẫn nguồn

- Trợ lý roster chỉ cho provider chọn candidate/evidence ref opaque; backend kiểm allowlist và tự dựng câu trả lời từ dữ kiện canonical. Prose tự do của model không được lưu.
- Profile context được batch theo resource, không còn N+1 khi roster lớn.
- RAG giới hạn candidate trong SQL trước khi tải evidence, nhưng dùng cùng exact-token/evidence rank ở SQL và Python để không làm mất hồ sơ tốt trước cap.
- Chuẩn hóa tìm kiếm xử lý dấu tiếng Việt, `Đ/đ`, Unicode decomposed và dấu phân cách Unicode. Đoạn trích dài giữ đúng raw offset của token có bằng chứng.
- URL import có deadline bao trùm DNS, kết nối, header và body; blocking worker được giới hạn để timeout không sinh thread vô hạn.

### Hồ sơ năng lực

- Góc nhìn HR có thêm trung bình `assessmentContributionScore` và `assessmentAttitudeScore` từ assessment đã duyệt.
- Điểm assessment được tách khỏi điểm ghi nhận/điều chỉnh thủ công để tránh trộn hai khái niệm.

## Công thức đã khóa bằng test

### Điểm assessment

```text
question = answer / maxScore × 10
group = Σ(question × questionWeight) / Σ(questionWeight)
dimension = Σ(group × groupWeight) / Σ(groupWeight)
total = Σ(group × groupWeight) / Σ(groupWeight)
```

Làm tròn hai chữ số theo half-up. ID câu hỏi lạ/trùng, boolean, score ngoài `1..maxScore` hoặc thiếu câu có trọng số khi submit đều bị từ chối.

### Năm chiều Hộ chiếu

Mỗi assessment tính từng dimension từ các group có `passportDimension`, theo `group.weight`. Sau đó các assessment đã duyệt đóng góp ngang nhau:

```text
passportDimension = average(dimensionScore của từng assessment đã duyệt)
```

Snapshot cũ thiếu mapping không sinh điểm cho dimension đó.

### Điểm phù hợp nhân sự

```text
hard condition: phải có đủ 100% requiredSkills
matchScore = round_half_up(70 + 30 × averageRequiredSkillRating / 5)
```

Do hard condition đã đạt 100%, 70 điểm biểu diễn coverage bắt buộc; tối đa 30 điểm còn lại phản ánh rating 1–5 của đúng kỹ năng yêu cầu.

## Kiểm thử đã chạy trên working tree hiện tại

- Backend full suite SQLite: **655 passed, 18 skipped**, 53.58 giây.
- Backend full suite PostgreSQL 17 trên database test sạch: **673 passed**, 114.33 giây.
- Alembic nâng schema sạch từ `0001` đến `0018`: **PASS**; `alembic check`: **PASS**, không drift.
- Frontend full Vitest: **148 passed trong 20 file**, 8.89 giây.
- Ruff: **PASS**.
- Ruff format check 144 file: **PASS**.
- mypy toàn bộ `app`: **PASS**, 90 source file.
- ESLint toàn frontend: **PASS**.
- TypeScript `tsc --noEmit`: **PASS**.
- Next.js 16 production build: **PASS**, 17 routes.
- OpenAPI export và generated TypeScript contract: **current**.
- Bandit: **0 medium/high**; pip-audit và npm production audit: **0 vulnerability đã biết**.
- `git diff --check`: **PASS**.
- Independent read-only review của toàn bộ P0/P1 remediation: **APPROVE**, không còn P0/P1 có thể hành động; source được commit nguyên trạng tại implementation SHA ở trên.
- Playwright/browser/persona: **NOT_RUN** theo yêu cầu hiện tại.
- Gitleaks exact-SHA: **NOT_RUN** vì candidate chưa có clean SHA và binary không có trong checkout.

Database PostgreSQL cũ ở cổng 55432 có Alembic version `0004` nhưng từng được `metadata.create_all` bổ sung bảng mới, nên không còn là nguồn kiểm chứng hợp lệ. Không xóa hoặc truncate database này. Gate ở trên dùng PostgreSQL 17 cô lập tại cổng 55441, schema được tạo hoàn toàn bằng Alembic.

## Việc còn chặn bàn giao tester

1. Push branch tích hợp cùng implementation/report commit để tester lấy đúng candidate.
2. Tester chạy manual browser flow; Playwright chỉ chạy khi user mở lại gate này.
3. Gitleaks exact-SHA cần chạy ở môi trường có binary trước khi merge/cutover.
