# CareerMate v2 — Bàn giao hợp nhất để team kiểm thử

Ngày hợp nhất: **12/09/2026**

Worktree chuẩn: **`.claude/worktrees/v2-qa`**

Branch chuẩn: **`codex/v2-qa-consolidation`**

## 1. Nguồn đã gom

| Nguồn | Nội dung được giữ trong candidate |
| --- | --- |
| `origin/master` tại `8d5eee37` | Toàn bộ code v1 mới nhất để đối chiếu: profile, 5 role, layout hai tầng, competency request, activity evidence, avatar, import mở rộng và roadmap |
| `feat/v2-rebuild` tại `6e1eafd` | FastAPI/Next.js v2, auth, tenant, AI boundary, import có evidence, profile aggregate, resources và timeline |
| Worktree appearance | Bright Milo, preset giao diện sáng và cài đặt hiển thị |
| Worktree assessment builder | Trình tạo bộ tiêu chí và preview; hiện vẫn là bản nháp phía frontend |
| Worktree people search | Typed search, deterministic ranking và UI tìm người; provider/catalog thật còn thiếu cấu hình |
| Worktree QA | 5 role, company scope, lộ trình WORK/PERSONAL, persistence, optimistic locking và bộ Docker QC |
| Worktree integration | Tài liệu 8 giờ và screenshot của competency resources |

Các worktree nguồn vẫn được giữ nguyên. Recovery snapshot của mọi thay đổi chưa commit nằm tại
`/private/tmp/careermate-consolidation-20260912-132308`.

## 2. Chức năng team có thể kiểm thử ngay trong v2

- Đăng nhập và phân quyền `SUPER_ADMIN`, `COMPANY_ADMIN`, `BOD`, `HR`, `EMPLOYEE`.
- Sidebar theo role; Super Admin chọn công ty rồi mới đi vào tầng quản trị công ty.
- Hồ sơ cá nhân, skills, kinh nghiệm, dự án, chứng chỉ, giải thưởng và timeline nghề nghiệp.
- Import hồ sơ nền tảng theo proposal có evidence và thao tác apply riêng.
- Danh sách nhân sự theo tenant và quyền quản lý cấp dưới.
- Lộ trình `Công việc`/`Cá nhân`, tạo nhiều lộ trình, milestone, task, ngày dự kiến, hoàn thành task và lưu display settings.
- Giao diện Milo sáng, trung tính; theme settings theo tài khoản.
- People Search có schema rõ và deterministic ranking.
- Assessment template builder có UI/preview, chưa có persistence backend.

## 3. Logic mới từ nhánh chính và trạng thái migrate

| Logic mới ở `origin/master` | Trạng thái trong v2 |
| --- | --- |
| 5 role và quan hệ quản lý theo cấp | **Đã migrate**; backend quyết định quyền, BOD/HR vẫn có không gian cá nhân |
| Layout hai tầng Super Admin → công ty | **Đã migrate**; company scope đi qua query và permission |
| Roadmap WORK/PERSONAL, nhiều roadmap, milestone/task | **Đã migrate phần lõi**; có transaction, chống retry trùng và version conflict |
| Profile resources và timeline | **Đã migrate** theo aggregate v2 |
| Avatar upload | **Chưa nối runtime v2** |
| Thông tin cá nhân mở rộng | **Chưa nối runtime v2** |
| Activity evidence upload/link | **Chưa nối runtime v2** |
| Yêu cầu chứng chỉ/giải thưởng gửi đích danh HR | **Chưa nối runtime v2** |
| Import mở rộng và chống gợi ý skill trùng | **Một phần**; v2 đã chống document trùng và selective apply, chưa parity toàn bộ field của v1 |
| AI roadmap, lịch sử Markdown và liên kết goal | **Chưa migrate** |
| Dashboard tổng hợp mới | **Chưa migrate dữ liệu thật** |

Các phần chưa nối không được hiển thị như chức năng hoàn thành. Code agent đang viết dở đã được chuyển vào
`v2/.orchestration/stopped-wip/2026-09-12/` để review sau; nó không nằm trong runtime hoặc Alembic chain.

## 4. Quyết định khi UI hoặc button bị trùng

Candidate hiện dùng các quyết định an toàn sau:

- Giữ riêng **Chỉnh sửa hồ sơ**, **Thêm nội dung hồ sơ** và **Nhập từ tài liệu** vì ba thao tác có mục đích khác nhau.
- Giữ **Tạo lộ trình** và **Cài đặt hiển thị**. Nút **Mind map AI** chỉ xuất hiện trong demo có nhãn đề xuất; API thật không giả dữ liệu AI.
- Chưa thêm nút **Gửi HR duyệt** vào v2 cho tới khi inbox/outbox và transaction backend được port đầy đủ.
- Giữ assessment builder dưới khu vực công ty với nhãn **Bản xem trước**, tránh nhầm với luồng đánh giá đã lưu.
- Giữ theme settings vì đã có code và phù hợp bộ giao diện Milo; admin không được theme làm thay đổi quyền.

Các quyết định cần product owner xác nhận sau vòng tester:

1. Nút **Gửi HR duyệt** nên nằm ngay từng dòng chứng chỉ/giải thưởng hay trong một tab “Yêu cầu xác minh”.
2. **Mind map AI** nên nằm trong trang lộ trình hay mở thành trang chi tiết riêng.
3. Có giữ ba preset giao diện cho nhân viên ngay ở bản đầu hay chỉ phát hành preset mặc định CareerMate.

## 5. Cách chạy cho tester

Không chạy từ checkout `master` đang có thay đổi cục bộ. Chạy trong worktree chuẩn:

```bash
cd /Users/minhhieutran/Desktop/Mad/Proj/go-with-us/.claude/worktrees/v2-qa
bash v2/scripts/qc.sh up
```

Mở `http://localhost:3140/login`. API docs ở `http://localhost:8140/api/v2/docs`.
Mật khẩu QC nằm trong `v2/.qc.env`, file có quyền `600`, không commit và không đưa vào report.

Phiên hợp nhất này không chạy Playwright theo yêu cầu. Tester nên tập trung vào:

- đăng nhập đủ 5 role;
- Super Admin chọn company và quay lại tầng hệ thống;
- chặn route sai quyền và chặn dữ liệu khác company;
- sửa hồ sơ, thêm/sửa/xóa resource;
- tạo, reload và hoàn thành task trong roadmap WORK/PERSONAL;
- theme, people search và assessment preview;
- ghi rõ mọi button có ý nghĩa trùng hoặc gây hiểu nhầm.

## 6. Giới hạn bàn giao

Đây là candidate hợp nhất để nhận feedback, chưa phải full parity hoặc release production. Các report/screenshot cũ chỉ là bằng chứng lịch sử của đúng SHA khi chúng được tạo; không thay thế kiểm thử lại trên candidate hiện tại.
