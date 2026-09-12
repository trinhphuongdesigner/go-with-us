# Stopped agent work — 2026-09-12

Các file trong thư mục này được giữ nguyên từ những agent đã dừng theo yêu cầu của chủ dự án.
Đây là tài liệu phục hồi và review, không nằm trong runtime hoặc Alembic chain của CareerMate v2.

Không đưa trực tiếp các file này trở lại `backend/app` hoặc `backend/alembic/versions` trước khi xử lý:

- `profile_extensions` định nghĩa lại bảng `activity_logs` vốn đã dùng cho audit log.
- `career_ai` tạo provider gateway song song với `app.ai.gateway`, đồng thời có giả định provider/model chưa được xác minh.
- `talent_workflows` mới có model/schema, chưa có service, route, transaction và permission gate hoàn chỉnh.
- Migration `0011_profile_extensions.py` phụ thuộc các model trên và sẽ xung đột tên bảng nếu chạy nguyên trạng.

Recovery snapshot đầy đủ trước khi hợp nhất được lưu ngoài repository tại
`/private/tmp/careermate-consolidation-20260912-132308`.
