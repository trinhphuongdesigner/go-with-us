# CareerMate — Milo theo mockup gốc

Bản v2 sửa theo ảnh người dùng gửi: Milo áo tím, hai tay cầm tablet, dáng nhỏ gọn; bệ tròn có thành dày, mặt sáng và bóng đổ mềm. Đây là cụm giao diện để đối chiếu với mockup gốc, kèm các phần riêng để team dùng trong code.

## File

| File | Định dạng | Cách dùng |
| --- | --- | --- |
| `milo-purple-tablet.png` | PNG RGB, 1254 × 1254 | Milo đã dựng lại từ ảnh tham chiếu, nền trắng |
| `step-current.svg` | SVG, 260 × 152 | Bệ tím ở bước hiện tại |
| `step-completed.svg` | SVG, 260 × 152 | Bệ xanh hoàn thành |
| `step-upcoming.svg` | SVG, 260 × 152 | Bệ sáng cho bước sắp tới |
| `step-goal.svg` | SVG, 260 × 152 | Bệ sáng cho mục tiêu |
| `check-marker.svg` | SVG, 96 × 100 | Dấu hoàn thành có chiều sâu |
| `goal-flag.svg` | SVG, 104 × 176 | Cờ mục tiêu màu tím |
| `milo-contact-shadow.svg` | SVG, 200 × 60 | Bóng tiếp xúc dưới chân, tách riêng khỏi ảnh |
| `reference-crop.png` | PNG | Ảnh đối chiếu người dùng cung cấp; không dùng làm asset sản phẩm |
| `preview.html` | HTML | Bản xem lộ trình, chọn bước và đối chiếu mẫu |

Bốn bệ và hai marker là vector, không có nền hình chữ nhật. Bóng đổ được giữ mềm như trong mẫu. Không có chữ/số cố định trong các file bệ.

**Giới hạn của ảnh Milo:** công cụ gen ảnh vẫn xuất RGB, không có alpha thật. Component dùng `mix-blend-mode: multiply` trên vùng lộ trình nền trắng để hòa phần nền ảnh, giống cách xem trên mockup. Cách này không biến PNG thành ảnh trong suốt và chưa được dùng cho nền tối hoặc nền màu. Việc xuất PNG/WebP alpha riêng vẫn đang chờ quyền dùng Python tách nền từ câu hỏi trước. Không có thao tác chỉnh raster bằng Python trong bản này.

## Component React

`frontend/src/components/brand/MiloRoadmapStep.tsx` và CSS module đi cùng:

```tsx
import { MiloRoadmapStep } from '@/components/brand/MiloRoadmapStep';

<MiloRoadmapStep
  number={2}
  title="Giao tiếp & phản hồi"
  status="current"
  period="Tuần 3 – 5"
  width={160}
  message="Tiếp tục bước tiếp theo nhé!"
/>
```

`status`: `completed | current | upcoming | goal`. `showMilo` mặc định bật cho bước hiện tại; đặt `false` nếu muốn tắt. `message=""` ẩn bong bóng. Số bước, tiêu đề, thời gian và câu nói là chữ thật để sửa/đổi ngôn ngữ được. Component dùng `next/image` và kế thừa font của ứng dụng.

Component là phần hiển thị. Parent quản lý lựa chọn bước, focus bàn phím, checkbox và lưu dữ liệu. Trạng thái có nhãn văn bản và bước hiện tại dùng `aria-current="step"`; hình minh họa là trang trí. CSS của preview được lấy trực tiếp từ CSS module của component để tránh hai bản hình thức khác nhau.

Trang preview chỉ dùng dữ liệu minh họa, không gọi API hoặc lưu DB. Các route hiện có chưa được thay bằng preview này. Các sửa đổi khác đang có trong checkout được giữ nguyên.

## Rebuild

Chạy từ `frontend/`:

```sh
node scripts/generate-milo-reference-assets.mjs
node scripts/build-milo-reference-preview.mjs
```

Nhân vật được tạo bằng công cụ `image_gen` tích hợp, lấy ảnh người dùng làm tham chiếu. Đây là dựng lại ở độ phân giải cao từ mẫu mờ, không phải khẳng định trùng từng pixel. Prompt và kết quả kiểm tra nằm trong `output/assets/careermate-v2-reference/`.
