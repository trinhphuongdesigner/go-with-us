# CareerMate v2 — khởi động và bàn giao QC

Checkout: branch `codex/v2-qa-consolidation`, worktree `.claude/worktrees/v2-qa`.
Chạy lệnh **trong worktree này**, không dùng root checkout cũ. Tính năng và đường đi
chi tiết: [RUNTIME-MIGRATION.md](./RUNTIME-MIGRATION.md). Nguồn/provenance và các lát
cắt trước đó: [CONSOLIDATION.md](./CONSOLIDATION.md).

Đợt này triển khai theo yêu cầu **build-only**: không thêm/chạy test suite mới, không
thực hiện live AI calls, và chưa kết luận PASS QC cho các luồng được chuyển mới.

## Khởi động

Cần Docker Desktop đang chạy, Docker Compose v2 hỗ trợ `--wait`, Git và OpenSSL.
Từ repository root của worktree:

```bash
bash v2/scripts/qc.sh up
```

Lệnh build backend Python 3.12 và Next.js production, khởi động PostgreSQL QC riêng,
chạy migration tới head, seed dữ liệu tổng hợp rồi khởi động web/API. Lệnh không chạy
tests. Build đầu tiên cần mạng để tải dependency và image. ClamAV khởi động riêng và
có thể cần thêm thời gian tải database nhận diện; upload vẫn fail closed nếu scanner
chưa sẵn sàng. OCR dùng Tesseract trong image backend.

Mở [CareerMate QC](http://localhost:3140/login).
API docs: [localhost:8140/api/v2/docs](http://localhost:8140/api/v2/docs).
Demo mode frontend **tắt**; dữ liệu lấy từ FastAPI local.

## Tài khoản

Lần đầu script tạo `v2/.qc.env` với password ngẫu nhiên riêng từng role và quyền file
`600`. File bị loại khỏi Git và Docker build context. Mở file bằng editor cục bộ để lấy
password; không dán nội dung vào chat, ảnh chụp hoặc báo cáo.

| Role | Email đăng nhập | Key trong `.qc.env` |
| --- | --- | --- |
| SUPER_ADMIN | `superadmin@careermate.dev` | `QC_SUPER_ADMIN_PASSWORD` |
| COMPANY_ADMIN | `admin@acme.dev` | `QC_COMPANY_ADMIN_PASSWORD` |
| BOD | `bod@acme.dev` | `QC_BOD_PASSWORD` |
| HR | `hr@acme.dev` | `QC_HR_PASSWORD` |
| EMPLOYEE | `alice@acme.dev` | `QC_EMPLOYEE_PASSWORD` |

Công ty thứ hai có `admin@northstar.dev`, `bod@northstar.dev`, `hr@northstar.dev`,
`alex@northstar.dev`, dùng cùng password key theo role. Trên database mới, tổng cộng
2 công ty/9 tài khoản. BOD, HR và EMPLOYEE có profile/roadmap cá nhân; admin thuần túy
quản trị theo scope. Không sửa role/password đã tồn tại khi seed lại.

## Các đường đi để kiểm tra thủ công

- **Alice / Alex:** Hồ sơ → hoạt động và yêu cầu công nhận năng lực; Lộ trình → Công việc /
  Cá nhân → lưu/chọn lại/tick task. Đánh giá → phiếu nháp → lưu/gửi. Hộ chiếu → xem/sửa
  tổng kết, xin tổng kết tổ chức, tạo/thu hồi link từ bản đã duyệt.
- **HR:** `/cong-ty/tieu-chi` → mẫu & chu kỳ thực sự lưu trên server; tạo/sửa/phát hành
  mẫu và mở/đóng chu kỳ. Xem yêu cầu công nhận đang chờ; sửa diễn giải tổng kết tổ chức
  sau khi BOD đã chạy tạo AI.
- **BOD:** `/danh-gia` → Chờ xét duyệt → duyệt/trả lại phiếu. `/ho-chieu` → Cần xác nhận
  → tạo tổng kết tổ chức bằng AI, đọc nội dung và xác nhận. Không tự duyệt bản của mình.
- **Admin:** `/job-requirements` → tạo/sửa/mở-đóng/xóa nhu cầu; AI đối chiếu nhân sự
  thuộc đúng công ty. Super Admin chọn doanh nghiệp trước thao tác company scope.
- **In/chia sẻ:** bản passport đã duyệt → In / lưu PDF (A4 dọc, chỉ bản được chọn), tải
  JSON; tạo link có hạn rồi thử thu hồi và mở lại link để ghi nhận hành vi thực tế.

Seed mới có template/cycle, assessment nháp/chờ duyệt/đã duyệt, award requests cho HR,
hoạt động, WORK/PERSONAL roadmaps/goals, passport summaries và job requirements. Dữ liệu
đều được gắn QC, không mô tả nhân sự/thành tích thật. Không seed link chia sẻ công khai.
Chạy lại không reset dữ liệu đã sửa nên số lượng/trạng thái có thể khác lần đầu.

Trang `/cong-ty/tieu-chi` là builder có lưu/publish; route `/cong-ty/tieu-chi/preview`
vẫn là bản preview riêng. Không dùng kết quả preview để kết luận persistence hoạt động.

## AI tùy chọn

Super Admin → `/cai-dat` → Kết nối AI → cấu hình Anthropic/OpenAI/Gemini. Lưu cấu hình
không gọi provider để kiểm tra. Chỉ có key thật và endpoint hoạt động thì các thao tác
AI mới trả đề xuất; lỗi provider hiện rõ và không tạo kết quả giả.

Có thể thêm các biến `CAREERMATE_AI_PROVIDER`, `CAREERMATE_AI_BASE_URL`,
`CAREERMATE_AI_MODEL`, `CAREERMATE_AI_API_KEY` vào `.qc.env` thay cho cấu hình qua UI,
rồi chạy `up` lại. Không đưa key vào lệnh dùng chung hoặc commit. Đợt triển khai này
chưa kiểm chứng live AI; người QC ghi kết quả provider thành một bước riêng.

Nếu đã có cấu hình Claude/Madison cục bộ, có thể chỉ định file tường minh:

```bash
QC_CLAUDE_SETTINGS=/absolute/path/settings.json bash v2/scripts/qc.sh up
```

Tùy chọn này chỉ đọc các trường kết nối được hỗ trợ từ file đã chọn vào môi trường
tiến trình con. Mặc định script không đọc private settings. Khi có key, seed chỉ thêm
kết nối provider nếu chưa tồn tại và lưu key đã mã hóa trong database; không ghi đè
kết nối đã cấu hình, không in key, không gọi AI. Lần rebuild sau dùng được kết nối mã
hóa mà không cần đọc lại file settings. Không commit hoặc sao chép file settings riêng.

## Build, trạng thái và dừng

```bash
bash v2/scripts/qc.sh build
bash v2/scripts/qc.sh status
bash v2/scripts/qc.sh logs
bash v2/scripts/qc.sh down
```

`build` chỉ tạo image, không chạy migration/seed. `up` thực hiện các bước đó và khởi
động. `down` giữ các named volume PostgreSQL, uploads, ClamAV và `.qc.env`; lần `up`
tiếp theo dùng lại database. Không có lệnh wipe/reset. Không xóa `.qc.env` khi vẫn giữ
volume: đổi password PostgreSQL trong file không tự đổi password database đã khởi tạo.

Các cổng chỉ bind loopback. Đổi `QC_WEB_PORT` (3140), `QC_API_PORT` (8140),
`QC_DB_PORT` (55440) trong `.qc.env` nếu cần, rồi chạy `up` để rebuild API URL của
frontend. Dùng trình duyệt trên cùng máy chạy Docker.

Nếu build/migration/seed lỗi, script dừng trước các bước sau. Giữ volume và credentials,
đọc lỗi và xử lý rồi chạy lại. Không chạy `docker compose config` nếu thiếu `--quiet`
vì cấu hình mở rộng chứa secrets. Gói này chỉ dành cho dữ liệu QC tổng hợp ở local,
không phải hướng dẫn triển khai production.
