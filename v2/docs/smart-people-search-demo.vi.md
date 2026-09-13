# Kịch bản demo Smart People Search — AI thật

## Mục tiêu trình diễn

Trong khoảng 90 giây, chứng minh ba điểm:

1. HR hỏi bằng ngôn ngữ tự nhiên thay vì đọc từng CV.
2. CareerMate tìm trong đúng công ty và đưa ra bằng chứng từ kỹ năng, kinh nghiệm, dự án.
3. Madison chỉ diễn giải tập ứng viên đã truy xuất; AI không tự thêm người hoặc thay đổi thứ tự.

## Chuẩn bị trước khi lên sân khấu

- Mở CareerMate tại URL đang chạy và đăng nhập bằng **QC People Partner — Acme Demo Corp**.
- Vào **Đội ngũ → Tìm theo yêu cầu → Hỏi AI**.
- Không mở DevTools khi trình diễn; extension Chrome có thể tạo log không liên quan ứng dụng.
- Bộ seed dùng trực tiếp 3 persona hiện có trong Acme: **QC Alice**, **QC People Partner** và
  **QC Director**. Các tài khoản, tenant và quyền là runtime thật; nội dung kỹ năng, kinh nghiệm
  và dự án là dữ liệu QC hư cấu được lưu trong PostgreSQL local.

## Hero flow — câu hỏi chính

Nhấn gợi ý hoặc nhập:

> Ai phù hợp dẫn dắt dự án React trong quý tới?

### Lời dẫn đề xuất

“Thay vì lọc hàng chục CV, HR chỉ mô tả nhu cầu. Trước khi gọi AI, CareerMate khóa phạm vi ở Acme
và truy xuất hồ sơ mà tài khoản này được phép xem.”

Kết quả kỳ vọng:

- **QC Alice — Software Engineer** đứng đầu.
- Bằng chứng gồm React 5/5, Technical Leadership 4/5, 5 năm kinh nghiệm và dự án
  **Atlas Customer Portal** ở vai trò Frontend Tech Lead.
- Các ứng viên React khác vẫn được hiển thị cùng phần còn thiếu; **QC Alice** có nhãn
  **Tự khai báo**, trong khi dữ liệu demo chính có nhãn **Đã xác minh**.

### Điểm cần chỉ trên màn hình

1. Dòng “AI chỉ tổng hợp từ các bằng chứng bên dưới”. Đây là dấu hiệu Madison đã trả lời thành công.
2. Tên và vai trò của ứng viên đứng đầu.
3. Badge từ khóa khớp.
4. Hai nhãn nguồn **Kỹ năng/Dự án** và **Đã xác minh/Tự khai báo**.

### Câu chốt

“Điểm khác biệt không phải ô chat; đó là lớp tin cậy. Quyền truy cập và retrieval quyết định AI được
nhìn thấy ai, còn mỗi kết luận đều quay lại được nguồn hồ sơ.”

## Hai câu hỏi dự phòng đã kiểm chứng

### Nhu cầu backend/AI

> Tìm người có FastAPI và PostgreSQL cho dự án AI nội bộ.

Kỳ vọng: **QC Alice** khớp cả FastAPI và PostgreSQL từ kỹ năng và dự án
**Atlas Customer Portal**.

### Nhu cầu thiết kế

> Ai có kinh nghiệm Figma và accessibility để cải thiện hành trình nhân viên?

Kỳ vọng: **QC People Partner** đứng đầu với Figma 4/5, Accessibility 4/5 và dự án
**Employee Growth Journey**.

## Cách giải thích công nghệ trong 20 giây

“CareerMate dùng Structured Profile RAG: FastAPI truy xuất kỹ năng, kinh nghiệm và dự án từ
PostgreSQL theo tenant và RBAC. Chỉ tập evidence đã được phép mới gửi sang Madison qua giao thức
Anthropic-compatible. Output được kiểm tra strict schema và reference; mã ứng viên không hợp lệ bị
từ chối. Nếu AI timeout hoặc sai định dạng, retrieval vẫn trả kết quả deterministic và không bịa thêm
ứng viên.”

## Phương án dự phòng khi mạng hoặc Madison chậm

- Không reload liên tục. Chờ trạng thái hiện tại kết thúc rồi thử lại đúng một lần.
- Nếu UI báo AI chưa khả dụng nhưng vẫn hiện danh sách bằng chứng, tiếp tục demo và nói:
  “Đây là fail-safe production: provider lỗi không làm mất kết quả đã truy xuất và không tạo người giả.”
- Chuyển sang tab **Tìm theo yêu cầu** nếu cần minh họa bộ lọc có cấu trúc mà không phụ thuộc AI.

## Kết quả xác minh ngày 12/09/2026

Cả ba câu hỏi trên đã gọi API thật `/api/v2/people-search/ask` với Madison và đều trả:

- HTTP 200;
- `status: ok`;
- `answer_source: ai`;
- không có warning;
- toàn bộ evidence trong ba kết quả chính mang nhãn đã xác minh.
