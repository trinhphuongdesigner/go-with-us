# Công cụ quality gate và báo cáo CareerMate v2

Các script này kiểm tra backend, frontend và mọi báo cáo hiện có mà không khởi động Docker hoặc thay đổi database.

## Lệnh chính

```bash
# Validate một report
python3 v2/scripts/validate_report.py v2/reports/<feature>/qa-report.json

# Render README.md + report.html (tiếng Việt, escape an toàn)
python3 v2/scripts/render_report.py v2/reports/<feature>/qa-report.json

# Chạy gate (backend + frontend + report nếu có)
bash v2/scripts/check.sh
```

## Ranh giới

- Validator dùng stdlib, không thêm jsonschema dependency.
- Kiểm tra fail-closed: cấu trúc top-level, SHA khớp, ID duy nhất, cross-reference AC → check, đủ bốn persona, status và invariant PASS hợp lệ.
- Renderer chỉ chạy sau khi report hợp lệ, escape toàn bộ text không tin cậy và sinh output xác định.
- check.sh không khởi động Docker, không chạy migration/xoá DB.
- Test: chỉ stdlib unittest.

## Test script

```bash
cd v2/scripts
python3 -m unittest discover -s tests -p "test_*.py" -v
```

`check.sh` gom lỗi và trả exit code khác 0 nếu bất kỳ gate nào thất bại; không che lỗi bằng `|| true`.
