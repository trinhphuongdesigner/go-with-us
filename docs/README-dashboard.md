# TÀI LIỆU PHÂN TÍCH, CẢI TIẾN & KỊCH BẢN DEMO DASHBOARD CAREERMATE

> **Đối tượng áp dụng:** CareerMate v2 (Milo Design System)  
> **Màn hình:** Trang Tổng quan (Dashboard - Không gian làm việc cá nhân)  
> **Tài khoản mẫu:** Nguyễn Khánh Linh (Product Designer - Góc nhìn cá nhân)

---

## MỤC LỤC
1. [Tổng Quan Về Màn Hình Dashboard](#1-tổng-quan-về-màn-hình-dashboard)
2. [Giải Phẫu Chi Tiết Từng Phần Tử & Công Thức Tính Toán](#2-giải-phẫu-chi-tiết-từng-phần-tử--công-thức-tính-toán)
   - [A. Header & Lời chào ngữ cảnh](#a-header--lời-chào-ngữ-cảnh)
   - [B. 4 Thẻ chỉ số cốt lõi (Key Metrics Cards)](#b-4-thẻ-chỉ-số-cốt-lõi-key-metrics-cards)
   - [C. Năng lực trọng tâm — Khoảng cách đến mục tiêu (Skill Gap Analysis)](#c-năng-lực-trọng-tâm--khoảng-cách-đến-mục-tiêu-skill-gap-analysis)
   - [D. Lộ trình phát triển cùng linh vật Milo (Gamified Journey)](#d-lộ-trình-phát-triển-cùng-linh-vật-milo-gamified-journey)
   - [E. Cảnh báo kỳ đánh giá định kỳ sắp tới](#e-cảnh-báo-kỳ-đánh-giá-định-kỳ-sắp-tới)
3. [Đề Xuất Các Điểm Cải Tiến Nâng Cấp](#3-đề-xuất-các-điểm-cải-tiến-nâng-cấp)
4. [Kịch Bản Thuyết Trình Demo Hoàn Chỉnh (~60–90 giây)](#4-kịch-bản-thuyết-trình-demo-hoàn-chỉnh-6090-giây)

---

## 1. TỔNG QUAN VỀ MÀN HÌNH DASHBOARD

Màn hình **Tổng quan (Dashboard)** là **Trung tâm chỉ huy cá nhân (Personal Command Center)** của mỗi nhân sự trong CareerMate. 

Màn hình này tích hợp đồng bộ 4 trụ cột nghiệp vụ:
1. **Hồ sơ năng lực 360° (Competency Profile):** Tổng hợp kỹ năng, kinh nghiệm, dự án và bằng chứng thực tế.
2. **Mục tiêu phát triển (Development Goals):** Theo dõi các mục tiêu OKR/KPI cá nhân ngắn và dài hạn.
3. **Lộ trình cá nhân hóa cùng Milo (Career Roadmap):** Chia nhỏ mục tiêu thăng tiến thành các sprint tuần dễ thực hiện.
4. **Kỳ đánh giá định kỳ (Performance Review):** Chuẩn bị minh chứng và xem trước tiêu chí đánh giá minh bạch.

### Hai chế độ hiển thị (Role-based View):
- **Góc nhìn cá nhân (Employee):** Tập trung vào tiến độ của bản thân, khoảng cách kỹ năng cá nhân và nhiệm vụ hàng tuần cùng Milo.
- **Góc nhìn quản lý (Manager / Admin):** Chuyển sang theo dõi tỷ lệ hoàn thiện hồ sơ của cả đội ngũ, mục tiêu chung và các cảnh báo nhân sự cần hỗ trợ.

---

## 2. GIẢI PHẪU CHI TIẾT TỪNG PHẦN TỬ & CÔNG THỨC TÍNH TOÁN

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [Góc nhìn cá nhân]  Cập nhật hôm nay                                            │
│ Chào buổi sáng, Linh                                             [Mở lộ trình →]│
│ Bạn đang đi đúng hướng. Đây là những việc quan trọng nhất...                      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### A. Header & Lời chào ngữ cảnh
* **Huy hiệu vai trò (Badge):** Tự động nhận diện từ phiên đăng nhập:
  * Nhân viên: Nhãn `Góc nhìn cá nhân` (màu trung tính).
  * Quản lý/Admin: Nhãn `Góc nhìn quản lý` (màu xanh lá).
* **Lời chào cá nhân hóa:**
  ```text
  Lời chào = "Chào buổi sáng, " + [Tên gọi cuối cùng trong Họ và Tên]
  Ví dụ: "Nguyễn Khánh Linh" -> "Chào buổi sáng, Linh"
  ```
* **Nút "Mở lộ trình ->":** Điều hướng nhanh đến bản đồ lộ trình chi tiết (`/lo-trinh`).

---

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Hồ sơ năng lực  │ │Mục tiêu đang làm│ │Chặng hoàn thành │ │Đánh giá tiếp theo│
│     84%         │ │       3         │ │      2/6        │ │     18/09       │
│Đã xác minh 12 tt│ │1 mục tiêu cần cn│ │Tiến độ đúng k/h │ │18 tháng 9, 2026 │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### B. 4 Thẻ chỉ số cốt lõi (Key Metrics Cards)

#### 1. Thẻ "Hồ sơ năng lực" — `84%` | *"Đã xác minh 12 thông tin"*
* **Ý nghĩa con số `84%`:** Tỷ lệ hoàn thiện tổng thể hồ sơ 360°.
* **Công thức tính toán:**
  Hồ sơ được chia thành 7 nhóm danh mục với tỷ trọng cố định:
  1. Thông tin cơ bản & Chức danh: 15%
  2. Kỹ năng chuyên môn: 25%
  3. Kinh nghiệm làm việc: 20%
  4. Dự án thực tế: 20%
  5. Bằng cấp & Chứng chỉ: 10%
  6. Giải thưởng & Thành tựu: 5%
  7. Dòng thời gian sự nghiệp: 5%

  ```text
  Tỷ lệ hoàn thiện hồ sơ = Tổng (Tỷ lệ hoàn thành mỗi mục × Trọng số mục đó)
  Ví dụ: Đạt 84% khi đã điền đủ thông tin cơ bản, kinh nghiệm, dự án và một số kỹ năng trọng yếu.
  ```

* **Ý nghĩa dòng *"Đã xác minh 12 thông tin"*:**
  Hệ thống CareerMate phân loại rõ ràng 2 nguồn dữ liệu:
  * **Tự khai (SELF):** Do nhân viên tự gõ tay vào form, chưa có gì chứng minh.
  * **Đã xác minh (IMPORT / ADMIN):** Trích xuất từ tài liệu thật (CV, văn bằng, hợp đồng) hoặc do Quản lý phê duyệt.
  
  **12 thông tin đã xác minh của bạn Linh gồm:**
  * `03` Kỹ năng chuyên môn (Product discovery, Prototyping, User research trích từ CV/Portfolio đã duyệt).
  * `02` Kinh nghiệm làm việc (Hồ sơ tại Acme Việt Nam và công ty trước đó).
  * `03` Dự án thực tế (CareerMate, Design System, Mobile App có xác nhận vai trò).
  * `02` Chứng chỉ uy tín (Google UX Design, IELTS có file PDF đính kèm).
  * `01` Giải thưởng (Nhân viên xuất sắc quý do công ty trao tặng).
  * `01` Chức danh chính thức (Product Designer do HR xác nhận).
  * **Tổng cộng: 3 + 2 + 3 + 2 + 1 + 1 = 12 thông tin có bằng chứng nguồn gốc (`EvidenceRef`).**

---

#### 2. Thẻ "Mục tiêu đang thực hiện" — `3` | *"1 mục tiêu cần cập nhật"*
* **Ý nghĩa con số `3`:**
  ```text
  Số mục tiêu active = Đếm số mục tiêu (Goals) có trạng thái = "IN_PROGRESS"
  ```
* **Ý nghĩa dòng *"1 mục tiêu cần cập nhật"*:**
  Kích hoạt khi có mục tiêu rơi vào 1 trong 2 điều kiện:
  * Đã quá 14 ngày chưa thực hiện check-in tiến độ mới.
  * Ngày hết hạn (`dueDate`) còn dưới 7 ngày nhưng tiến độ chưa đạt mốc tương ứng.

---

#### 3. Thẻ "Chặng đã hoàn thành" — `2/6` | *"Tiến độ đúng kế hoạch"*
* **Ý nghĩa con số `2/6`:**
  * `2`: Số cột mốc lộ trình (Milestones) đã đạt trạng thái `DONE`.
  * `6`: Tổng số cột mốc được thiết lập trong lộ trình thăng tiến hiện tại.
* **Quy tắc chuyển đổi trạng thái tự động:**
  * Mỗi chặng bao gồm danh sách các nhiệm vụ cụ thể (`DevelopmentTask`).
  * Nếu 100% nhiệm vụ hoàn thành: Chặng chuyển sang **`DONE`**.
  * Nếu có ít nhất 1 nhiệm vụ hoàn thành: Chặng chuyển sang **`IN_PROGRESS`**.
  * Nếu chưa có nhiệm vụ nào: Chặng giữ **`NOT_STARTED`**.
* **Ý nghĩa dòng *"Tiến độ đúng kế hoạch"*:**
  Ngày hiện tại vẫn nằm trong khung thời gian dự kiến của chặng thứ 3 (chưa bị trễ hạn).

---

#### 4. Thẻ "Đánh giá tiếp theo" — `18/09` | *"18 tháng 9, 2026"*
* Mốc thời gian mở cổng đánh giá năng lực định kỳ (360 Performance Review) do HR thiết lập. Giúp nhân sự chủ động hoàn thiện hồ sơ và chuẩn bị tài liệu minh chứng trước thời hạn.

---

```
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│ NĂNG LỰC TRỌNG TÂM            (84%)  │  │ [Lộ trình cùng Milo]            42%  │
│ Khoảng cách đến mục tiêu             │  │                                      │
│                                      │  │ Giao tiếp & phản hồi                 │
│ Giao tiếp & phản hồi        62 / 80  │  │ Đang thực hiện · Tuần 3–5            │
│ [██████████████████░░░░░░]           │  │                                      │
│ Tư duy sản phẩm             74 / 85  │  │ ✓ 2 nhiệm vụ đã hoàn thành           │
│ [████████████████████░░░░]           │  │                                      │
│ Dẫn dắt nhóm                48 / 70  │  │ [Tiếp tục bước tiếp theo →]   🦊(Milo)│
│ [█████████████░░░░░░░░░░░]           │  │                                      │
│ Xem hồ sơ năng lực →                 │  │                                      │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
```

### C. Năng Lực Trọng Tâm — Khoảng Cách Đến Mục Tiêu (Skill Gap Analysis)

Khối này chỉ ra sự chênh lệch giữa **Năng lực thực tế hiện tại** và **Khung chuẩn năng lực kỳ vọng**:

#### 1. Thước đo khoảng cách kỹ năng:
* **Giao tiếp & phản hồi:** `62 / 80` (Tiến độ thanh: 77.5%)
* **Tư duy sản phẩm:** `74 / 85` (Tiến độ thanh: 87.1%)
* **Dẫn dắt nhóm:** `48 / 70` (Tiến độ thanh: 68.6%)

#### 2. Công thức đo lường chuẩn xác:

```text
Điểm mục tiêu (Target Score - số bên phải: 80, 85, 70):
= Tiêu chuẩn do Doanh nghiệp ban hành trong Job Requirement cho chức danh tiếp theo
  (Ví dụ: Cấp bậc Senior Product Designer cần mức sàn này).

Điểm hiện tại (Current Score - số bên trái: 62, 74, 48):
= Điểm số quy đổi từ kỳ đánh giá năng lực gần nhất + Minh chứng thực tế.

Khoảng cách kỹ năng cần bù đắp (Skill Gap):
Khoảng cách = Điểm mục tiêu (Target) - Điểm hiện tại (Current)

Ví dụ thực tế:
- Với kỹ năng "Giao tiếp & phản hồi":
  Khoảng cách = 80 - 62 = 18 điểm còn thiếu.
- Với kỹ năng "Dẫn dắt nhóm":
  Khoảng cách = 70 - 48 = 22 điểm còn thiếu.
```

---

### D. Lộ Trình Phát Triển Cùng Linh Vật Milo (Gamified Journey)

Khối này chuyển hóa khoảng cách kỹ năng thành hành động rèn luyện cụ thể mỗi ngày:

* **Con số `42%`:** Tiến độ của riêng chặng hiện tại (**Giao tiếp & phản hồi**):
  ```text
  Tiến độ chặng = (Số nhiệm vụ đã hoàn thành / Tổng số nhiệm vụ trong chặng) × 100%
  Ví dụ: Đã xong 2/5 bài tập thực hành -> Đạt 40 - 42%
  ```
* **Khung thời gian "Tuần 3–5":** Lộ trình được chia theo từng tuần ngắn hạn (Sprint-based) để nhân viên rèn luyện từng bước, không gây áp lực công việc.
* **Huy hiệu "✓ 2 nhiệm vụ đã hoàn thành":** Ghi nhận ngay thành quả để tạo động lực.
* **Linh vật Milo (AI Companion):** Hình ảnh chú cáo Milo tạo cảm giác thân thiện, biến việc phát triển bản thân thành trải nghiệm vừa học vừa chơi.

---

### E. Cảnh Báo Kỳ Đánh Giá Định Kỳ Sắp Tới

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [🛡️] Đánh giá năng lực sắp tới                                   [Xem tiêu chí]  │
│      Bạn có thể xem tiêu chí và chuẩn bị minh chứng trước ngày 18 tháng 9, 2026. │
└──────────────────────────────────────────────────────────────────────────────────┘
```
* **Mục đích:** Cảnh báo sớm đợt review để nhân viên chủ động.
* **Nút "Xem tiêu chí":** Dẫn tới `/danh-gia` để xem trước rubric chấm điểm, đảm bảo tính công bằng và minh bạch tuyệt đối.

---

## 3. ĐỀ XUẤT CÁC ĐIỂM CẢI TIẾN NÂNG CẤP

Nhằm đưa trải nghiệm sản phẩm từ mức MVP lên mức xuất sắc vượt trội, đề xuất các cải tiến sau:

| Hạng mục | Hiện trạng | Đề xuất cải tiến | Lợi ích mang lại |
| :--- | :--- | :--- | :--- |
| **Tương tác nhanh (Quick Action)** | Thẻ *"1 mục tiêu cần cập nhật"* chỉ là text tĩnh. | Cho phép bấm vào mở popup **"Quick Check-in"** cập nhật tiến độ trong 10 giây. | Giảm thao tác, tăng tỷ lệ nhân viên cập nhật mục tiêu định kỳ. |
| **Đếm ngược thời gian** | Thẻ đánh giá chỉ hiện ngày `18/09`. | Hiển thị thêm nhãn đếm ngược: **`Còn 6 ngày`** kèm đổi màu cam nổi bật khi sát ngày. | Tạo cảm giác cấp thiết (Urgency) giúp nhân viên chuẩn bị minh chứng sớm. |
| **Gợi ý lấp khoảng cách** | Thanh kỹ năng hiện `62 / 80`. | Hover vào hiện popup gợi ý: *"Còn thiếu 18 điểm. Gợi ý: Hoàn thành 1 bài chia sẻ nội bộ (+10đ) hoặc nhận 1 Peer Review (+8đ)."* | Giúp nhân viên biết chính xác hành động cần làm để đạt điểm. |
| **Lời khuyên từ Milo** | Milo chỉ là hình ảnh minh họa tĩnh. | Milo có bong bóng thoại đổi mới mỗi ngày: *"Hôm nay hoàn thành nốt 1 task nhé Linh ơi!"* | Tăng tính gắn kết (Emotional connection) và cá nhân hóa trải nghiệm. |
| **Chuyển góc nhìn (Switcher)** | Phải đổi tài khoản giữa Employee và Manager. | Thêm nút gạt nhanh: **[Cá nhân] ⮀ [Đội ngũ của tôi]** cho tài khoản Team Lead/Manager. | Tiện lợi cho quản lý vừa tự học vừa theo dõi team. |
| **Hiệu ứng thành tựu** | Khi xong task chỉ tăng số phần trăm. | Thêm hiệu ứng pháo hoa nhẹ (Confetti) và Milo vỗ tay chúc mừng khi chặng đạt 100%. | Kích hoạt cảm xúc chiến thắng (Gamification Dopamine boost). |

---

## 4. KỊCH BẢN THUYẾT TRÌNH DEMO HOÀN CHỈNH (~60–90 GIÂY)

Anh có thể sử dụng kịch bản 3 bước dưới đây khi trình bày với ban giám khảo, nhà đầu tư hoặc ban giám đốc:

---

### [BƯỚC 1: MỞ ĐẦU — NÊU BẬT VẤN ĐỀ (15 GIÂY)]
*(Mở màn hình Tổng quan, di chuột nhẹ vào khu vực Lời chào)*

> **"Kính thưa mọi người, đây là màn hình Tổng quan — Trung tâm chỉ huy cá nhân của CareerMate.**  
> Trong doanh nghiệp, nỗi trăn trở lớn nhất của nhân viên thường là: *'Tôi đang ở đâu, cần cải thiện gì để thăng tiến, và khi đánh giá thì sếp dựa vào tiêu chí nào?'*  
> CareerMate giải quyết trọn vẹn bài toán đó ngay trên một màn hình duy nhất thông qua 3 giá trị cốt lõi."

---

### [BƯỚC 2: THÂN BÀI — 3 ĐIỂM CHẠM VÀNG (45 GIÂY)]

*(Di chuột qua hàng 4 thẻ chỉ số phía trên)*
> **"Thứ nhất là Sự Minh Bạch và Đáng Tin Cậy:**  
> Ngay phía trên là 4 chỉ số then chốt. Điểm đặc biệt là con số **84% hồ sơ năng lực**, đi kèm **12 thông tin đã được xác minh bằng chứng thực tế** từ CV, văn bằng và dự án đã duyệt — loại bỏ hoàn toàn việc nhân viên khai khống hồ sơ. Nhân viên cũng biết chính xác kỳ đánh giá tiếp theo là ngày 18/09 để chủ động chuẩn bị."

*(Chỉ chuột sang khối bên trái: Năng lực trọng tâm)*
> **"Thứ hai là Đo Lường Khoảng Cách Kỹ Năng (Skill Gap Analysis):**  
> Không đánh giá cảm tính, hệ thống chỉ rõ khoảng cách giữa năng lực hiện tại và chuẩn kỳ vọng của vị trí tiếp theo. Ví dụ: Kỹ năng *Giao tiếp & phản hồi* đang đạt 62/80 điểm, nhân viên biết đích xác mình cần bù đắp 18 điểm nữa để đạt chuẩn Senior."

*(Chỉ chuột sang khối bên phải: Chú cáo Milo)*
> **"Và thứ ba là Hành Động Thực Tế Cùng Linh Vật Milo:**  
> Biết mình thiếu kỹ năng rồi thì làm gì? AI CareerMate cùng chú cáo Milo lập tức chia nhỏ mục tiêu thành các chặng sprint theo tuần rất khả thi. Chặng này đã đạt 42% với 2 nhiệm vụ hoàn thành. Nhân viên chỉ việc bấm **'Tiếp tục bước tiếp theo'** để rèn luyện mỗi ngày như đang tham gia một trò chơi."

---

### [BƯỚC 3: KẾT BÀI — GIÁ TRỊ MANG LẠI (15 GIÂY)]
*(Bao quát toàn màn hình)*

> **"Tóm lại, CareerMate biến việc phát triển sự nghiệp từ mơ hồ, áp lực thành một lộ trình rõ ràng, minh bạch và có người đồng hành từng bước. Nhân viên hào hứng nâng tầm bản thân, còn doanh nghiệp thì phát hiện và giữ chân đúng nhân tài.**  
> Xin cảm ơn mọi người!"**
