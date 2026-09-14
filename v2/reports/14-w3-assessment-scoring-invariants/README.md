# W3-ASSESSMENT-SCORING-INVARIANTS

Trạng thái slice: **PASS** tại implementation/verification SHA `f465af6bac2c6a30059fc791895db46a08d5952c`. Independent final review đã **APPROVE, 0 P0/P1/P2** sau khi đóng một P1 và hai P2. Toàn Wave 3 vẫn **IN_PROGRESS** vì template, cycle, assignment, submit/reject và audit trail còn phải được xác minh theo slice riêng.

## Giá trị chức năng

Kết quả đánh giá giờ được tính hoàn toàn bằng code xác định. Cùng một immutable snapshot và cùng answers luôn cho cùng kết quả; AI không tính, sửa hoặc bù điểm. Khi admin approve, backend tính lại từ `template_snapshot` và `answers` đã lưu, nên việc sửa template sống sau lúc submit không thay đổi kết quả lịch sử.

## Công thức

- Điểm câu hỏi: `q_i = answer_i / maxScore_i * 10`.
- Điểm nhóm: `G = Σ(q_i × questionWeight_i) / Σ(questionWeight_i)`.
- Điểm dimension: `D = Σ(G_j × groupWeight_j) / Σ(groupWeight_j)` trong từng `CONTRIBUTION` hoặc `ATTITUDE`.
- Tổng điểm: `Total = Σ(G_j × groupWeight_j) / Σ(groupWeight_j)` trên mọi nhóm có trọng số dương.
- Làm tròn: `ROUND_HALF_UP` bằng `Decimal` đến `0.01`; `8.125 → 8.13`.

Tổng điểm là weighted average của tất cả nhóm, không phải trung bình của hai dimension. Dimension không có nhóm hỗ trợ trả `null`, không tự tạo điểm trung tính `5`.

## Validation và fail-closed

- Group ID và question ID phải duy nhất; question ID duy nhất trên toàn snapshot.
- Answer chỉ nhận question có thật, mỗi question một answer, score là integer không phải boolean và nằm trong `1..maxScore`.
- Submit/approve yêu cầu đủ answer cho mọi question có trọng số dương thuộc group có trọng số dương.
- Toàn template phải có ít nhất một group dương; mỗi group phải có ít nhất một question dương.
- Snapshot bắt buộc có `group.weight`, `group.scoreDimension`, `question.weight`, `question.maxScore`; reader không mượn default từ authoring schema.
- API authoring giữ strict types. Reader snapshot riêng chấp nhận numeric string legacy hợp lệ, hữu hạn, không phải boolean; dữ liệu sai trả 422 thay vì `TypeError` hoặc điểm âm thầm.

## Bằng chứng

- RED trước fix: **3 failures/27** — negative question weight được nhận, string weight gây `TypeError`, duplicate question ID bị ghi đè.
- Focused scoring: **33 passed**.
- Scoring + offboarding: **38 passed**.
- Backend full: **719 passed, 20 skipped trong 68.48s**.
- Ruff PASS; mypy app **90 files PASS**.
- Frontend: **27 files/190 tests PASS trong 14.74s**; ESLint và typecheck PASS.
- Next.js build: **17/17 routes PASS trong 12.66s**.
- Independent final review: **APPROVE, 0 P0/P1/P2**.
- Browser/Playwright/persona/axe/visual regression: **NOT_RUN**.

## Review findings đã đóng

1. **P1:** Snapshot thiếu scoring fields từng được điền default authoring. Đã tách DTO snapshot và thêm bốn case thiếu-field trả 422.
2. **P2:** Snapshot legacy có numeric string hợp lệ cần tiếp tục đọc được. Đã cô lập coercion trong snapshot reader; authoring API vẫn strict.
3. **P2:** Thiếu coverage duplicate group ID với question ID khác nhau. Đã thêm regression và xác minh 422.

## Giới hạn

Snapshot legacy sai cấu trúc hoặc có numeric string không hợp lệ sẽ fail closed 422. Trước migration/cutover cần audit và repair các row này nếu tồn tại. Slice không thêm `passportDimension` mapping và không thay đổi Career Passport scoring. AI không tham gia phép tính.

Nguồn chuẩn: `qa-report.json`.
