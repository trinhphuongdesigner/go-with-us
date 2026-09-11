# CareerMate · Milo × Sage — Figma handoff

File thiết kế: [CareerMate — Milo × Sage · UI handoff](https://www.figma.com/design/1VWq6SA4aANBTPKznNIT5Z/CareerMate-Milo-Sage?node-id=6-89).

Bản này kết hợp lộ trình bậc tròn và Milo từ hướng thiết kế ban đầu với bảng màu sage/beige. Đây là bản dựng lại bằng layer Figma có thể sửa; không phải ảnh mockup đặt vào một frame. Có điều chỉnh typography và khoảng cách, không cam kết trùng từng pixel với ảnh AI.

## Các màn hình

Trang Figma: **01 · Screens — Milo Sage**. Mỗi frame 1586 × 992.

| Frame | Node | Nội dung |
| --- | --- | --- |
| 01 · Lộ trình phát triển | 6:89 | Bậc tròn, Milo, tiến độ, công việc và tài liệu |
| 02 · Sơ đồ chi tiết — Đề xuất AI | 6:247 | Nhánh công việc, nguồn minh họa, chọn và xác nhận lưu |
| 03 · Tùy chỉnh lộ trình — Bản nháp | 6:398 | Mục tiêu, thời lượng, sắp xếp cột mốc, nhân vật và cách hiển thị |
| 04 · Tổng quan cá nhân | 6:582 | Lộ trình, hồ sơ năng lực, việc cần làm và trợ lý |

Ngoài bốn màn hình có **00 · Foundations**, các component gốc, asset Milo và **05 · Handoff notes**. `Page 1` chứa các tham chiếu/thử nghiệm trước đó, không phải bản bàn giao.

## Cho team triển khai

- 259 text layer, 39 component instance, 96 nhóm Auto Layout trong bốn màn hình. Sidebar, button và segmented control dùng component; có 9 component gốc trong 4 component set.
- 36 biến trong `CM · Primitives` và `CM · Theme`, 11 text style và 1 effect style. Font **Geist**, nội dung 16–18 px, nhãn phụ 14 px.
- `tokens.json` và `tokens.css` mô tả các giá trị dùng trong thiết kế. Chữ xanh dùng `primaryText` để đủ tương phản trên nền sage/beige; nền nút và tiến độ dùng `primary`.
- `assets/milo-sage-white.png` là asset được dùng. Đây là PNG nền trắng, không phải alpha trong suốt. Layer Milo trên màn hình dùng **Multiply**; khi triển khai có thể dùng `mix-blend-mode: multiply` trên nền sáng hoặc chuẩn bị asset alpha riêng.
- `assets/milo-sage.png` là ứng viên thử nghiệm có nền checkerboard, **không dùng** trong bản bàn giao.

## Xuất từ Figma

Chọn frame 01–04, mở **Export** ở panel phải. Đã cấu hình **PNG @2x** (3172 × 1984) và **SVG** giữ text. Muốn chỉnh sửa đầy đủ, dùng file Figma gốc. SVG có text cần font Geist trên máy sử dụng.

Các PNG đã được xuất thử và xem trong Figma để kiểm tra bố cục. Gói local này gồm asset và token; không chứa bốn ảnh PNG xuất từ Figma. Có thể xuất trực tiếp từ link file trên.

## Hành vi cần giữ

AI gợi ý → người dùng xem nguồn, chỉnh sửa/chọn đầu việc → xác nhận Lưu. Checkbox trong sơ đồ là chọn đưa vào lộ trình; checkbox ở bảng công việc là trạng thái hoàn thành. Đổi nhân vật/cách hiển thị không thay đổi tiến độ. Trạng thái phải có cả chữ/icon và màu.

Tất cả nhân vật người dùng, tiến độ và trích đoạn nguồn là dữ liệu minh họa. Đây là mockup desktop, chưa nối dữ liệu thật, chưa có responsive mobile hay tương tác ứng dụng.

## Kiểm tra

Đã kiểm tra ảnh xuất của bốn màn hình; sửa vị trí Milo trên trang tổng quan, nhãn bậc đầu tiên và màu chữ xanh. Kiểm tra hình học sau sửa: không có text layer vượt khung cha trong bốn frame. `contrast-check.json` ghi các cặp màu chữ/nền được sử dụng; đây không phải kiểm định WCAG đầy đủ cho ứng dụng đã triển khai.
