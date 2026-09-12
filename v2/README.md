# CareerMate v2 — chạy trên máy mới cho QC

Hướng dẫn này chạy **FastAPI + Next.js + PostgreSQL**, giao diện Bright Milo, bằng
Docker. Không chạy `backend/` và `frontend/` ở gốc repository: đó là source v1
NestJS/MUI. Dùng nhánh **`codex/v2-qa-consolidation`**, không dùng `master`.

Máy mới sẽ có database QC và mật khẩu riêng. Clone Git **không mang theo** dữ liệu,
file upload, mật khẩu hoặc kết nối AI của máy người khác.

## 1. Chuẩn bị máy

- Có quyền truy cập repository `trinhphuongdesigner/go-with-us` trên GitHub.
- Cài Git, Bash, OpenSSL và Docker với Docker Compose v2 hỗ trợ `up --wait`.
- Mở Docker trước khi chạy. Không cần cài Node.js, Python, PostgreSQL hay Prisma
  trên máy host; Docker cài dependency và chạy dịch vụ.
- Cần mạng cho lần build đầu: tải image, dependency và dữ liệu nhận diện ClamAV.

**macOS:** dùng Terminal và [Docker Desktop](https://docs.docker.com/desktop/).

**Windows:** dùng Docker Desktop chạy Linux containers với WSL 2; bật tích hợp
Docker cho distro Ubuntu và chạy các lệnh Bash bên dưới trong terminal Ubuntu/WSL,
không dán trực tiếp vào PowerShell. Xem [hướng dẫn Docker cho Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
Clone trong thư mục Linux của WSL, không sao chép thư mục worktree từ máy Mac.
Nếu Ubuntu thiếu Git/OpenSSL: `sudo apt-get update` rồi `sudo apt-get install git openssl`.

**Linux:** dùng Docker Engine + Compose plugin hoặc Docker Desktop; tài khoản hiện
tại phải gọi được Docker. Không cần chạy script QC bằng `sudo`.

Kiểm tra từ chính terminal sẽ dùng để chạy app:

```bash
git --version
bash --version
openssl version
docker version
docker compose version
docker compose up --help
```

`docker version` phải kết nối được Server; lệnh cuối cần có tùy chọn `--wait`.
Trên Apple Silicon, compose đã chỉ định ClamAV `linux/amd64`; phần này chạy qua
emulation nên lần khởi động đầu có thể chậm hơn các dịch vụ khác.

## 2. Clone đúng nhánh

Chạy tại thư mục bạn muốn chứa source; tên `careermate-qc` phải chưa tồn tại:

```bash
git clone --branch codex/v2-qa-consolidation --single-branch https://github.com/trinhphuongdesigner/go-with-us.git careermate-qc
cd careermate-qc
git branch --show-current
git log -1 --oneline
```

Nếu GitHub báo không có quyền, đăng nhập bằng cơ chế GitHub của bạn hoặc nhờ cấp
quyền repo. Không đặt token vào URL clone hoặc gửi token trong chat.

**Không cần tạo `.claude/worktrees/v2-qa` trên máy mới.** Đó chỉ là đường dẫn của
máy phát triển. Sau clone, thư mục `careermate-qc` chính là repository root cần dùng.
Mọi lệnh `bash v2/scripts/qc.sh ...` bên dưới chạy tại đây, không `cd v2` trước.

## 3. Một lệnh build → migrate → seed → chạy

```bash
bash v2/scripts/qc.sh up
```

Script thực hiện:

1. Tạo `v2/.qc.env` nếu chưa có, sinh mật khẩu QC riêng và giới hạn quyền đọc file.
2. Build image backend/frontend production; frontend dùng API thật, không bật demo.
3. Khởi động PostgreSQL và ClamAV.
4. Chạy Alembic migration tới head và seed dữ liệu QC tổng hợp.
5. Khởi động web/API, đợi healthcheck và in thông báo `QC is ready`.

Không cần tạo `.env` thủ công trước, không chạy migration Prisma hay seed v1.
Không chạy test suite. Nếu lỗi, script dừng; xử lý lỗi rồi chạy lại cùng lệnh,
không xóa volume để thử lại.

Khi hoàn tất, mở trên **chính máy chạy Docker**:

- Web: [http://localhost:3140/login](http://localhost:3140/login)
- API docs: [http://localhost:8140/api/v2/docs](http://localhost:8140/api/v2/docs)

Trang đăng nhập QC có menu **Tài khoản demo**. Chọn một người để tạo phiên thật và
vào thẳng dashboard, không cần mở `.qc.env` hoặc nhập mật khẩu khi trình diễn.
Tính năng đăng nhập nhanh chỉ được bật trong compose local QC; staging/production
không thể bật cấu hình này. Form email/mật khẩu vẫn hoạt động bình thường.

Kiểm tra trạng thái:

```bash
bash v2/scripts/qc.sh status
```

Web/API/database cần `healthy`. ClamAV có thể còn `starting` để tải dữ liệu;
upload sẽ bị chặn an toàn nếu scanner chưa sẵn sàng. Không tắt scanner để bỏ qua lỗi.

## 4. Đăng nhập và dữ liệu mẫu

Mở **`v2/.qc.env` bằng editor trên máy cục bộ**, lấy giá trị bên phải dấu `=` của
key tương ứng. Không dùng mật khẩu từ máy người khác và không gửi file này lên Git/chat.
Phần này chỉ cần khi muốn kiểm tra luồng đăng nhập bằng mật khẩu hoặc thay đổi tài khoản;
demo thông thường có thể chọn người trực tiếp trên trang login.

| Role | Email | Key mật khẩu trong `.qc.env` |
| --- | --- | --- |
| Super Admin | `superadmin@careermate.dev` | `QC_SUPER_ADMIN_PASSWORD` |
| Company Admin | `admin@acme.dev` | `QC_COMPANY_ADMIN_PASSWORD` |
| BOD | `bod@acme.dev` | `QC_BOD_PASSWORD` |
| HR | `hr@acme.dev` | `QC_HR_PASSWORD` |
| Employee | `alice@acme.dev` | `QC_EMPLOYEE_PASSWORD` |

Công ty thứ hai có `admin@northstar.dev`, `bod@northstar.dev`, `hr@northstar.dev`,
`alex@northstar.dev`, dùng key mật khẩu theo role như trên.

Database mới có 2 công ty, 9 tài khoản, hồ sơ, mẫu/chu kỳ/phiếu đánh giá, yêu cầu
công nhận, lộ trình Công việc/Cá nhân, tổng kết hộ chiếu và nhu cầu nhân sự.
Seed không tạo link chia sẻ công khai hay membership chéo công ty tự động.

Chạy lại `up` **không reset** dữ liệu QC đã sửa hoặc mật khẩu đã đổi qua UI.
Nếu từng đổi mật khẩu trong app, mật khẩu ban đầu trong `.qc.env` có thể không còn
đúng; dùng mật khẩu mới hoặc nhờ admin reset theo quyền.

## 5. AI là cấu hình riêng, không bắt buộc để khởi động

Máy mới không có sẵn key Madison hay key của máy phát triển. Luồng nhập/lưu tay vẫn
dùng được; các thao tác AI cần kết nối nhà cung cấp hoạt động.

Đăng nhập Super Admin → **Cài đặt → Kết nối AI** → cấu hình provider, base URL,
model và key được cấp riêng. Key được lưu mã hóa; không đưa vào source hoặc README.
Lưu cấu hình chưa chứng minh provider gọi thành công; QC thử thao tác AI riêng.

Nếu muốn đọc cấu hình Claude cục bộ do chính bạn sở hữu, xem mục AI tùy chọn trong
[QC-QUICKSTART.md](./QC-QUICKSTART.md); tùy chọn này cần `jq`. Mặc định script không
đọc private settings. Không chia sẻ `.claude/settings.json` của người khác.

## 6. Lần chạy sau và lấy code mới

Chạy lại sau khi bật Docker:

```bash
cd careermate-qc
bash v2/scripts/qc.sh up
```

Lệnh `cd` ở trên dành cho trường hợp đang đứng ở thư mục cha; nếu đã ở repository
root thì bỏ qua. Để lấy code mới, trước tiên kiểm tra không có thay đổi cục bộ:

```bash
git status --short
git branch --show-current
```

Chỉ khi status sạch và đang ở `codex/v2-qa-consolidation`, chạy:

```bash
git pull --ff-only origin codex/v2-qa-consolidation
bash v2/scripts/qc.sh up
```

Nếu có file đang sửa hoặc pull không fast-forward, dừng và hỏi người phụ trách;
không dùng `reset --hard`, không force pull. `.qc.env` bị Git bỏ qua nên không xuất
hiện trong status thông thường và không bị pull ghi đè.

Các lệnh khác:

```bash
bash v2/scripts/qc.sh build   # Chỉ build image, không migrate/seed/khởi động
bash v2/scripts/qc.sh status  # Trạng thái container
bash v2/scripts/qc.sh logs    # Log web/API; kiểm tra và che dữ liệu nhạy cảm trước khi gửi
bash v2/scripts/qc.sh down    # Dừng, giữ database/uploads/ClamAV volume
```

Không xóa `.qc.env`, đổi JWT secret tùy tiện hoặc chạy `docker compose down -v`:
volume chứa dữ liệu QC, và cấu hình AI mã hóa cần khóa máy chủ tương ứng.
Mỗi Docker engine hiện dùng chung project `careermate-v2-qc`; clone repo lần hai
trên cùng Docker engine không tự tạo môi trường/database độc lập.

## 7. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| `docker: command not found` / không kết nối daemon | Mở Docker; trên Windows kiểm tra WSL integration cho đúng distro và chạy lại `docker version`. |
| `bash` / `openssl` không tồn tại | Dùng terminal Bash; cài công cụ còn thiếu trên host/WSL. |
| `unknown flag: --wait` | Cập nhật Docker Compose để hỗ trợ `up --wait`. |
| Không có `v2/scripts/qc.sh` | Kiểm tra đúng nhánh QC và đang đứng ở repository root. Không chạy hướng dẫn v1. |
| Không tải được image/npm/Python dependency | Kiểm tra mạng/proxy/quyền registry, đọc lỗi rồi chạy lại `up`. |
| Build bị kill/hết RAM hoặc dung lượng | Tăng tài nguyên Docker theo máy, giải phóng dung lượng có kiểm soát; không xóa volume QC. |
| Cổng 3140/8140/55440 đã dùng | Mở `.qc.env`, đổi `QC_WEB_PORT`/`QC_API_PORT`/`QC_DB_PORT`, chạy lại `up`; dùng URL với cổng mới. Frontend cần rebuild khi đổi cổng API. |
| Web chưa vào được ngay lúc khởi động | Đợi `QC is ready`, xem `status`, rồi mở lại link. |
| Upload bị lỗi scanner | Đợi ClamAV `healthy`; xem log scanner qua Docker Desktop, không vô hiệu hóa kiểm tra. |
| Đăng nhập sai | Kiểm tra đúng email/role, mật khẩu của máy này, hoặc mật khẩu đã đổi trong UI. Seed lại không reset password. |
| Migration/seed lỗi | Lưu lỗi đã che dữ liệu nhạy cảm, giữ database và `.qc.env`, gửi người phụ trách; không xóa dữ liệu để vượt lỗi. |
| AI báo chưa kết nối/401/403 | Cấu hình key/model/base URL hợp lệ trên máy mới; không phải lỗi khởi động app. |

Không chạy `docker compose config` để chia sẻ cấu hình vì output có thể chứa secret.

## 8. Máy khác chạy riêng hay cùng truy cập một server?

Hướng dẫn này dành cho **mỗi máy tự chạy một môi trường QC riêng**. `localhost` là
máy đang mở trình duyệt, không phải máy của người gửi link. Compose hiện chỉ bind
`127.0.0.1`, nên đổi link sang IP LAN của máy chủ là chưa đủ.

Nếu team muốn dùng chung dữ liệu trên một server, cần cấu hình triển khai riêng:
địa chỉ API public lúc build frontend, CORS, HTTPS/reverse proxy và kiểm soát truy cập.
Không mở PostgreSQL ra Internet. File compose QC này không phải cấu hình production;
chưa có hướng dẫn tự động chuyển database/upload từ máy phát triển sang máy khác.

## 9. Bàn giao kết quả cho team

Ghi commit (`git rev-parse --short HEAD`), hệ điều hành, role/công ty, URL, bước thao
tác và lỗi mong đợi/thực tế. Không kèm password, API key, token share hoặc dữ liệu thật.

- [Các luồng QC theo role](./QC-QUICKSTART.md)
- [Phạm vi migrate và giới hạn tính năng](./RUNTIME-MIGRATION.md)

Kiểm tra mốc runtime đang chạy bằng `git rev-parse --short HEAD`; migration hiện tới
`0016`. PR #7 `3a6a75f` của master chưa migrate vào mốc v2 này. Chưa xác nhận chạy trên máy
QC mới/Windows bằng hướng dẫn này; build/health thành công không thay thế QC nghiệp vụ.
