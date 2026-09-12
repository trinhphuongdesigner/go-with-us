# CareerMate v2 — bàn giao runtime cho QC

Checkout: branch `codex/v2-qa-consolidation`, worktree `.claude/worktrees/v2-qa`.
Runtime: FastAPI / PostgreSQL và Next.js / Tailwind / Radix theo giao diện Bright Milo.
Khởi động và tài khoản: [QC-QUICKSTART.md](./QC-QUICKSTART.md).

## Trạng thái của đợt triển khai

Các luồng dưới đây đã có mã backend, migration và giao diện gọi API thật. Phần talent đã
được kiểm tra cú pháp Python và TypeScript trong quá trình xây dựng. **Chưa kết luận
PASS QC**: đợt này không thêm/chạy test suite và không gọi AI trực tiếp để kiểm chứng
kết quả nhà cung cấp. Build, khởi động Docker, thao tác trình duyệt và AI với khóa được
cấu hình là các bước cần được ghi nhận riêng theo bản chạy thực tế.

Checkpoint local **2026-09-12**: Docker build backend/frontend thành công (Next production
build gồm TypeScript); `qc.sh up` đã chạy migration tới `0015_rich_profile_import`, seed
thành công và cả frontend/backend/db/ClamAV đều healthy. Kiểm tra trạng thái database
ghi nhận 9 accounts, 18 assessments, 8 HR requests, 12 goals, 1 AI connection đã mã hóa.
Kết nối Madison được nhập từ file cục bộ đã được người dùng chỉ định; không in token
và chưa gọi provider. Các luồng form/approval/upload/AI chờ tester thao tác, không gắn PASS.

Nguồn nghiệp vụ đối chiếu là `origin/master:backend/src/modules/assessments`,
`career-passport`, `job-requirements`, Prisma schema và các trang frontend tương ứng.
Không coi prototype có phản hồi AI giả hoặc nhãn preview là tính năng tích hợp hoàn tất.

## Assessment: nguồn → v2

| Nghiệp vụ từ master | Backend v2 | Đường đi người dùng |
| --- | --- | --- |
| Mẫu nhóm/tiêu chí/trọng số/thang điểm | `/api/v2/assessments/templates`; tạo, phiên bản mới, publish, archive, delete không làm mất mẫu đã dùng | **Mẫu & chu kỳ** → `/cong-ty/tieu-chi` → Tạo mẫu mới / Chỉnh sửa → Lưu nháp hoặc Lưu & phát hành |
| Chu kỳ theo tháng, mẫu cố định, mở/đóng | `/assessments/cycles` | Chọn mẫu đã phát hành, tháng, hạn hoàn thành → Mở chu kỳ; đóng/mở lại tại danh sách |
| SELF / PEER / MANAGER | `/assessments`, `/assessments/colleagues` | `/danh-gia` → chọn chu kỳ, hình thức, đồng nghiệp → Tạo bản nháp |
| Lưu, gửi, sửa phiếu bị trả lại | `/assessments/{id}`, `/{id}/submit` | Chọn điểm và thêm minh chứng → Lưu thay đổi / Gửi đánh giá |
| HR chỉnh phiếu đã gửi; BOD xét duyệt | `/{id}/approve`, `/{id}/reject` | Chờ xét duyệt → mở phiếu → Phê duyệt / Yêu cầu chỉnh sửa |
| Chấm điểm đóng góp/thái độ | Điểm câu hỏi chuẩn hóa về 0–10; trung bình theo trọng số câu hỏi rồi trọng số nhóm | Điểm và trạng thái hiển thị trên phiếu; chỉ phiếu đã duyệt được đưa vào passport |

Mọi phiếu giữ `templateSnapshot` riêng. Chỉnh cấu trúc mẫu tạo phiên bản mới và lưu trữ
bản cũ, kể cả khi chưa có lượt sử dụng. Dữ liệu đã duyệt bất biến. Thao tác sửa dùng
`expectedVersion` và khóa bản ghi; dữ liệu cũ phải tải lại trước khi lưu. Không tự duyệt
đánh giá của chính mình. HR quản lý mẫu/chu kỳ và diễn giải; BOD duyệt; Company Admin
và Super Admin kế thừa chức năng quản trị khi có quyền tương ứng và đúng company scope.

## Career passport: nguồn → v2

| Nghiệp vụ từ master | Backend v2 | Đường đi người dùng |
| --- | --- | --- |
| Xem/thêm/sửa quá trình làm việc | `/career-passport`, `/career-passport/employments` | `/ho-chieu` → Quá trình làm việc → Thêm giai đoạn / Chỉnh sửa |
| AI đề xuất tổng kết → người dùng lưu | `/career-passport/summaries/generate`, `/summaries` | Chọn giai đoạn → AI đề xuất tổng kết → đọc/sửa → Lưu tổng kết để xác nhận |
| Xin tổng kết tổ chức | `/summaries/request` | Chọn giai đoạn cụ thể → Yêu cầu tổng kết từ tổ chức |
| BOD tạo AI, HR sửa diễn giải, BOD xác nhận | `/summaries/{id}/trigger`, PATCH `/{id}`, `/{id}/approve` | Cần xác nhận → AI tạo tổng kết tổ chức → HR lưu diễn giải → Xác nhận & đóng băng nội dung |
| Liên kết chia sẻ có hạn, thu hồi | `/career-passport/shares`, `/{id}/revoke` | Bản đã duyệt → chọn tên/hiệu lực → Tạo liên kết chia sẻ → sao chép; thu hồi ở danh sách liên kết |
| Xem công khai | `/api/v2/passport/{token}` | Mở `/passport/{token}` không cần đăng nhập |
| Xuất/in | `/career-passport/summaries/{id}/export` và giao diện in | Bản đã duyệt → Tải bản JSON hoặc In / lưu PDF |

Các thay đổi an toàn có chủ đích:

- Tổng kết cá nhân cũng cần người có thẩm quyền độc lập xác nhận trước khi chia sẻ.
- Chỉ snapshot đã duyệt và được chủ sở hữu chủ động tạo liên kết mới ra công khai.
  Token lưu dạng băm, có hạn, thu hồi được; nội dung công khai không đọc hồ sơ sống.
- Snapshot dùng danh sách trường cho phép: tên/chức danh, diễn giải, điểm đã duyệt,
  điểm mạnh/hướng phát triển và kỹ năng có nhãn nguồn tự khai báo. Không đưa email,
  ID người dùng, tên dự án, nhận xét nội bộ hay điểm nháp vào snapshot. Tên công ty,
  dự án và email được che trong phần diễn giải; người duyệt vẫn cần đọc nội dung trước khi xác nhận.
- Kết thúc một giai đoạn làm việc không tự xóa `User.company_id`: tài khoản và tenant
  vẫn theo invariant v2. Thay đổi tư cách tài khoản là thao tác quản trị riêng.
- Đánh giá/dimension scores do AI tạo cho tổng kết tổ chức khóa sau bước trigger;
  HR chỉ sửa diễn giải. AI thiếu cấu hình/lỗi/JSON sai thì hiện lỗi, không giả thành công.

Chế độ in có CSS trang **A4 dọc, lề 15 mm**, ngắt trang cho phần nội dung và không in
sidebar, form quản trị hoặc các tổng kết khác. Nút in sao chép riêng snapshot được chọn
vào vùng in tạm, rồi mở hộp thoại in của trình duyệt. Có thể chọn “Save as PDF”. Đây là
chức năng đã triển khai bằng mã; chưa kiểm tra bản PDF thực tế trong đợt build-only này.

## Job requirements: nguồn → v2

`/job-requirements` có form tạo/sửa, danh sách kỹ năng, trạng thái mở/đóng, xác nhận xóa
và AI đối chiếu ứng viên. API tương ứng là `/api/v2/job-requirements`, `/{id}` và
`/{id}/match`. Chỉ quản lý có quyền `people:write` được ghi/đối chiếu; đọc cần
`people:read`. Danh sách ứng viên được giới hạn trong doanh nghiệp; ID ngoài tập ứng viên
thật hoặc điểm AI không hợp lệ bị loại. Không tự phân công nhân sự sau kết quả AI.

## Tài khoản và dữ liệu mẫu cho các nhánh thao tác

Seed đầy đủ trên database mới tạo hai công ty và chín tài khoản. Acme có
`superadmin@careermate.dev` (platform), `admin@acme.dev`, `bod@acme.dev`, `hr@acme.dev`,
`alice@acme.dev`; Northstar có `admin@northstar.dev`, `bod@northstar.dev`,
`hr@northstar.dev`, `alex@northstar.dev`. BOD/HR/employee đều có hồ sơ cá nhân.

Fixtures tổng hợp mới gồm:

- 2 mẫu đã phát hành, 2 chu kỳ tháng 09/2026; 18 phiếu chia đều DRAFT/SUBMITTED/APPROVED.
- 6 hồ sơ thông tin cá nhân và 6 hoạt động; 8 yêu cầu AWARD gửi đến HR, gồm chờ duyệt
  và đã duyệt. Mỗi yêu cầu được duyệt có 20 điểm mẫu; không tự gửi cho chính HR.
- 12 roadmap WORK/PERSONAL ban đầu; tạo CareerGoal còn thiếu từ milestone cuối của
  mỗi roadmap. WORK ban đầu hoàn thành 1/4 task.
- 18 tổng kết: bản cá nhân nháp, bản cá nhân đã duyệt và yêu cầu tổ chức chưa chạy AI
  cho từng BOD/HR/employee; 2 nhu cầu nhân sự.

Đây không phải chứng chỉ, thành tích hoặc đánh giá nhân sự thật. Seed không tạo token
chia sẻ công khai và không gọi AI. Khi có key được cung cấp tường minh, seed chỉ tạo
kết nối provider còn thiếu với key mã hóa, không đổi kết nối đã lưu. Tất cả fixture có UUID ổn định;
chạy lại chỉ bổ sung phần thiếu, không ghi đè nội dung/điểm/trạng thái/password đã chỉnh.
Chu kỳ trùng tháng được tái dùng nguyên trạng, không tự mở lại. Vì vậy số lượng và tiến
độ trên database QC đã sử dụng có thể khác database mới.

## Kết nối AI

Super Admin → `/cai-dat` → **Kết nối AI**. Cấu hình provider, base URL HTTPS, model và
khóa của nhà cung cấp. Provider hỗ trợ Anthropic, OpenAI, Gemini; cấu hình có khóa lưu
trong database được ưu tiên theo thứ tự Anthropic → OpenAI → Gemini. Khóa được mã hóa,
API không trả khóa cho trình duyệt. Lưu cấu hình không đồng nghĩa đã gọi kiểm tra provider.

Có thể cấu hình tùy chọn trong `.qc.env`: `CAREERMATE_AI_PROVIDER`,
`CAREERMATE_AI_BASE_URL`, `CAREERMATE_AI_MODEL`, `CAREERMATE_AI_API_KEY`; rồi chạy `up`
để container nhận cấu hình. Chỉ mở file trên máy cục bộ; không đưa khóa vào Git/chat/log.

Tùy chọn đọc cấu hình Claude/Madison có sẵn: `QC_CLAUDE_SETTINGS=/absolute/path/settings.json
bash v2/scripts/qc.sh up` (viết trên một dòng). Mặc định không đọc file riêng. Script chỉ
chuyển các trường kết nối cần thiết vào môi trường con; seed lưu provider còn thiếu với
key mã hóa, không ghi đè kết nối đã lưu. Rebuild tiếp theo có thể dùng database mà không
đọc lại file. Tùy chọn không tự gọi nhà cung cấp AI.
Không đổi khóa JWT của database QC đã dùng tùy tiện vì cấu hình AI mã hóa sử dụng khóa
máy chủ đó khi không có encryption key riêng. Chưa có cấu hình thì thao tác AI báo
chưa kết nối; các luồng lưu tay vẫn sử dụng được.

## Các domain còn lại — ghi chú tích hợp bổ sung

### Hồ sơ 360°, import, hoạt động và yêu cầu công nhận

- `/ho-so`: chỉnh thông tin, thêm/chọn/xóa kỹ năng và rating/note, CRUD kinh nghiệm,
  dự án, chứng chỉ, giải thưởng; timeline, thông tin cá nhân, avatar, hoạt động/minh chứng.
- `/ho-so/nhap-da-nguon`: text/file/HTTPS URL → AI đề xuất 8 nhóm → chọn/chỉnh từng mục
  → refine hoặc xác nhận lưu. Kiểm version/dedup/idempotency, một transaction. Giữ riêng
  flow nhập chức danh có evidence của v2; không đánh dấu tự khai báo thành đã xác minh.
- `/yeu-cau-nang-luc`: chọn chứng chỉ/giải thưởng, giai đoạn làm việc, HR cụ thể;
  gửi snapshot, hộp đã gửi/đã nhận, duyệt hoặc từ chối và cộng điểm một lần.
- `/nhan-su/{id}`: quản lý xem thông tin/insight và sửa trường nhân sự được cấp quyền;
  quản lý giai đoạn làm việc. Tệp evidence/avatar chỉ tải qua API có xác thực.
- Docker có ClamAV riêng và Tesseract; ảnh/PDF OCR dùng bộ trích xuất giới hạn tài nguyên.
  `.xls` cần đổi `.xlsx`. URL nội bộ không được fetch. Upload giữ ở volume `qc-uploads`.
  Chưa dùng dữ liệu thật để kiểm chứng OCR/AI trong đợt này.

### Roadmap, goals, plan history và assistant

- `/lo-trinh`: giữ Công việc/Cá nhân, nhiều roadmap, goals CRUD/progress/status,
  lịch sử kế hoạch Markdown, AI đề xuất trước khi lưu, mục tiêu liên kết chặng cuối.
  Sửa/xóa cấu trúc có version, tick task, layout/nhân vật Milo–An–none và cài đặt riêng.
- `/tro-ly`: hội thoại lưu database, ghim/xóa, ngữ cảnh cá nhân hoặc roster được cấp quyền;
  proposal không tự sửa dữ liệu. `/cai-dat`: Bright Milo/Sky/Violet và kết nối AI do Super Admin quản lý.
- Chi tiết: [career-ai-migration.md](./contracts/career-ai-migration.md),
  [rich-profile-import-migration.md](./contracts/rich-profile-import-migration.md).

### Dashboard, roster và quản trị công ty/tài khoản

- `/dashboard` lấy số kỹ năng/dự án, tiến độ và việc sắp tới từ database; admin thấy
  số công ty/tài khoản thật. Không dùng số 84% hay hạn đánh giá hardcoded của mockup.
- `/cong-ty`, `/he-thong`, `/tai-khoan`: tạo công ty kèm admin, chỉnh ngành/tên,
  tạo/sửa/khóa tài khoản theo thứ bậc và scope; cấu hình quyền HR/BOD áp dụng trong công ty.
  Khóa công ty/tài khoản thay cho hard-delete để giữ hồ sơ/lịch sử đã được tham chiếu.
- `/nhan-su`: roster thật; `/nhan-su/tim-kiem`: chọn company cho Super Admin, AI phân tích
  truy vấn qua kết nối chung, chấm title/tenure bằng code. Điều kiện kỹ năng/domain/availability
  **chưa có projection bằng chứng verified** vẫn báo thiếu dữ liệu, không giả matching thành công.
- Tạo Super Admin đầu tiên dùng seed QC thay cho bootstrap-register của master; không mở
  đăng ký công khai. Theme vẫn lưu theo tài khoản trên trình duyệt, chưa đồng bộ nhiều thiết bị.
- Root dirty prototype, mock AI/mindmap và seed v1 đang sửa dở được giữ nguyên/snapshot,
  không overlay vào runtime v2. Source provenance ở [CONSOLIDATION.md](./CONSOLIDATION.md).

## Ghi nhận QC sau bàn giao

Khi kiểm tra thủ công, ghi lại commit/build đang chạy, tài khoản/role, công ty, đường dẫn,
bước thao tác, kết quả thực tế và lỗi nếu có. Tách lỗi build/migration, lỗi nghiệp vụ và lỗi
provider bên ngoài. Không ghi mật khẩu, token chia sẻ hay dữ liệu thật vào báo cáo.
