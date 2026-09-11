# Style Concept — Workflow Pro reference

Trích xuất từ `frontend/src/theme/theme.ts` và các pattern layout đang dùng
thật trong dự án Workflow Pro. File này dùng làm **tài liệu tham khảo phong
cách** khi dựng UI cho một dự án khác — đính kèm cùng
@docs/new-project-prompt-template.md. Không phải code để copy nguyên; nếu
dự án mới cần đổi màu/font, ghi đè ở tham số `{{PHONG_CACH_TUY_CHINH}}` của
template, phần còn lại (radius, shadow, spacing, component shape) nên giữ
nguyên trừ khi có lý do khác.

## 1. Color tokens

| Token | Giá trị | Vai trò |
|---|---|---|
| `bg` | `#F2EFE7` | Nền trang (body) — cream |
| `canvas` | `#F2EFE7` | Nền ngoài cùng quanh app shell |
| `surface` | `#ffffff` | Nền Card/Paper/Input |
| `text` | `#1c2836` | Chữ chính (navy ink) |
| `neutral400` | `#5a6f80` | Chữ phụ (`body2`, label mờ) |
| `neutral500` | `#6d8190` | Chữ phụ hơn nữa (table head uppercase) |
| `divider` | `#C8DFDB` | Viền/đường phân cách (seafoam) |
| `accent` | `#3368A0` | Primary (steel blue) |
| `accent300` | `#285480` | Primary dark (hover/pressed) |
| `accent700` | `#66A3BF` | Primary light |
| `accent900` | `#C8DFDB` | Nền tint nhạt cho badge/hover accent |
| `accentInk` | `#3368A0` | Chữ/icon trên nền trắng hoặc `accent900` |
| `accentContrast` | `#ffffff` | Chữ/icon trên fill `accent` (avatar, logo mark) |
| `success` | `#2d8a6e` | Trạng thái thành công/done |
| `danger` | `#c44b4b` | Trạng thái lỗi/xoá |

Một màu accent duy nhất (steel blue `#3368A0`), không dùng nhiều màu thương
hiệu — các trạng thái khác (success/danger) chỉ xuất hiện ở chip/badge,
không lấn sang button chính. Bộ swatch phụ (`#66A3BF`, `#C8DFDB`, `#F2EFE7`)
chỉ dùng cho light / tint / nền trang, không phải accent thứ hai.

## 2. Typography

- Font: `var(--font-sans), system-ui, sans-serif` — **1 font family**
  (Be Vietnam Pro) cho title, body, button, caption. Không mix heading/UI
  font khác. Mono (`--font-mono`) chỉ khi hiển thị code.
- `h1`: 32px / weight 500 / letter-spacing -0.01em — dùng cho tiêu đề trang
  lớn, không phải heading nội dung.
- `h2`: 22px / weight 500 — tiêu đề section/card.
- `h3`: 19px / weight 500 — tiêu đề phụ nhỏ hơn.
- `body1`: 15px / line-height 1.55 — nội dung chính.
- `body2`: 14px, màu `neutral400` — text phụ, mô tả dưới tiêu đề.
- `caption`: 12px, màu `neutral400` — meta nhỏ; không set `fontSize: 12`
  tay trên `body2`.
- `button`: không viết hoa (`textTransform: none`), weight 500, **1 dòng**
  (`whiteSpace: nowrap`) — khác mặc định MUI (uppercase + được wrap).
- Table head: 11px, uppercase, letter-spacing 0.08em, weight 600, màu
  `neutral500` — điểm ngoại lệ duy nhất được phép uppercase.

## 3. Shape & elevation

- Radius 3 mức: `sm=8`, `md=14` (mặc định cho hầu hết component), `lg=22`
  (cho khối lớn/modal).
- Shadow 3 mức (`shadows2`):
  - `card`: `0 1px 2px rgba(28,27,46,.04), 0 8px 22px rgba(28,27,46,.07)` —
    card tĩnh, không hover-lift.
  - `md`: `0 4px 16px rgba(28,27,46,.14)` — menu/dropdown.
  - `lg`: `0 24px 60px rgba(28,27,46,.18)` — modal/dialog nổi hẳn.
- `MuiButton`/`MuiCard`/`MuiOutlinedInput` đều `boxShadow: none` mặc định —
  độ sâu đến từ shadow token ở trên, không phải elevation mặc định của MUI.
  Button không có shadow kể cả khi `contained`, kể cả khi hover.

## 4. Layout patterns

- **AppShell + sidebar cố định** (`components/layout/AppShell.tsx`) bọc mọi
  trang đã đăng nhập; `PageContainer` + `PageHeader` (title + subtitle) mở
  đầu mỗi trang — pattern lặp lại 100% các trang, không có trang nào tự
  build header riêng.
- **Card làm đơn vị bố cục chính** (`components/ui/Card.tsx`, `title` prop
  tuỳ chọn) — list/table/form đều nằm trong 1-2 Card, không thả block trần
  ngoài Card.
- **Step indicator dạng pill ngang** cho quy trình nhiều bước (xem
  `StepIndicator.tsx`) — pill bị mute/disable khi bước đó chưa unlock, dựa
  trên 1 giá trị `maxUnlockedStep` tính từ trạng thái thật (không phải cờ
  hand-maintained).
- **Split-pane editor (source + preview)** cho nội dung Markdown/HTML do AI
  sinh ra — divider kéo được, preview bên phải: `mdToHtml` render cho
  Markdown, **iframe `sandbox=""` bắt buộc** khi preview là HTML do AI sinh
  ra (không bao giờ trust markup AI trả về — không execute script, không
  same-origin).
- **Modal xác nhận đề xuất AI (proposal → confirm)**: mọi hành động AI trả
  danh sách (câu hỏi, feature, đoạn nội dung) hiện trong modal với checkbox
  từng dòng, **mặc định checked** — trừ dòng "sẽ bị xoá" (destructive), mặc
  định **unchecked**. AI không bao giờ tự lưu; chỉ lưu khi người dùng bấm
  Save/Confirm.
- **Status chip theo tone**, không dùng text đổi màu tự do — mapping màu
  cố định theo trạng thái (draft/in-progress/done/completed...), tái dùng 1
  helper màu chung thay vì set màu tay ở từng nơi dùng.

## 5. Component style overrides (MUI)

| Component | Điểm khác mặc định MUI |
|---|---|
| `MuiButton` | radius 14; `md` minHeight 44 / padding `10px 18px` / font 14.5; `sm` minHeight 36 / padding `6px 12px` / font 13.5; nowrap; không uppercase; không shadow kể cả hover. Dùng `components/ui/Button`. |
| Icon | `sm=18` / `md=20` / `lg=24`. `MuiSvgIcon` mặc định `md`. Dùng `components/ui/IconButton`. |
| Dialog | radius `lg`, shadow `lg`. Form → `components/ui/Dialog`. Xóa → `ConfirmDialog`. |
| Loading | Trang fetch dùng `PageSkeleton` (table / list / form / profile / cards / page). Không spinner trần / “Loading…” / LinearProgress làm placeholder chính. |
| `MuiCard` | radius 14, border `1px solid divider`, shadow = token `card` |
| `MuiOutlinedInput` | radius 14, nền `surface`, viền `divider`; focus: viền `accent` + ring `0 0 0 3px rgba(51,104,160,.18)` |
| `MuiInputLabel` | 12px/500, màu `rgba(28,27,46,.65)` — nhạt hơn text chính |
| `MuiChip` | radius 10, weight 500, size 12 |
| `MuiTableCell` head | 11px uppercase letter-spacing 0.08em, màu `neutral500`, không có border-top |
| `MuiMenu` paper | radius 10, border `divider`, shadow token `md` |
| `MuiTooltip` | nền `text` (tối), chữ trắng, radius 8, luôn có `arrow`, `enterDelay: 300` |
| Scrollbar | custom 9px, thumb `accent700` (`#66A3BF`) radius 8, track trong suốt |

## 6. Interaction conventions

- **Save tường minh, không autosave ngầm cho nội dung dài** — mọi bước AI
  tạo nội dung (scope/predefined-scope/user-flow/draft-ui/docs) đều là
  draft trong editor, chỉ ghi khi bấm "Save". Field đơn giản (câu trả lời
  ngắn) mới autosave-on-blur.
- **AI trả proposal, không tự persist** — pattern xuyên suốt: gọi 1 skill
  endpoint → nhận `{ nội dung, summary }` → render preview → người dùng
  confirm mới gọi endpoint lưu thật (khác endpoint AI). Không có skill nào
  ghi DB/file trực tiếp.
- **Modal gọi AI ngay khi mount** (không phải khi bấm 1 nút riêng trong
  modal) — nên nơi gọi modal phải conditionally render (unmount khi đóng),
  không dùng `open` prop trên component luôn mounted, tránh gọi AI khi ẩn.
