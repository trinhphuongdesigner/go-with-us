# CareerMate — Agent rules & tiêu chí dự án

File này là **tiêu chí sản phẩm / cuộc thi** mà mọi quyết định (scope, UI, AI, demo, slide) phải bám theo. Nguồn ý tưởng gốc: `docs/y-tuong-phan-mem-danh-gia-nang-luc-nhan-vien 1.docx`. Scope triển khai: `docs/careermate-scope.md`. Convention kỹ thuật: `CLAUDE.md`. UI: `docs/style-concept.md`.

Khi xung đột:

- **Ý tưởng / “làm gì”:** file Word + file này.
- **Phạm vi cuộc thi (làm bao nhiêu):** mục 3 file này (khớp mục 4 của file Word).
- **Cách code:** `CLAUDE.md`.

---

## 1. Idea — 1 câu, rõ *làm gì / cho ai / để làm gì*

**Nguyên tắc cuộc thi:** mô tả idea **chỉ bằng 1 câu**. Đối tượng và mục đích gọn, không lan man.

### Elevator pitch (chốt — lấy từ mô tả dự thi)

> CareerMate là nền tảng đánh giá năng lực nhân sự toàn diện: HR nhìn nhân sự dưới nhiều góc độ xuyên suốt quá trình làm việc, còn mỗi người tự ghi nhận, tự đánh giá và chủ động phát triển mình — không phụ thuộc quản lý còn hay đã đi.

Câu tagline: *người bạn đồng hành xuyên suốt cùng mỗi nhân sự, từ ngày đầu gia nhập đến từng cột mốc phát triển tại công ty.*

| | |
|---|---|
| **Làm cái gì** | Nền tảng hồ sơ năng lực + đánh giá chéo + trợ lý tìm người / lộ trình phát triển |
| **Cho ai** | HR và toàn thể nhân sự trong công ty tri thức (outsourcing / product team). Sales, BOM, PM dùng cùng dữ liệu để staffing. |
| **Để làm gì** | Đánh giá công bằng, đủ dữ liệu khi tới kỳ lương/level; staffing dự án trong vài giây thay vì hỏi vòng vo DC lead → PM. |

Hai vai trò HR + Employee là **một sản phẩm hai mặt**, không phải hai idea. Câu chuyện gốc (file Word): PM nghỉ đúng tuần trước kỳ tăng lương → quản lý mới không có gì để đánh giá; BOD cần team mới thì phải hỏi lần lượt DC lead rồi từng PM.

**Không mở rộng idea:** ứng viên ngoài công ty, marketplace freelancer, payroll, chấm công, mạng xã hội nghề nghiệp. Career Passport (share cho công ty mới khi nghỉ việc) là **hệ quả kiến trúc** (`Employment` cả đời — xem `docs/careermate-scope.md`) và tầm nhìn sau demo, **không phải câu pitch chính**.

---

## 2. Pain points (bắt buộc nói được)

Lấy đúng 6 pain point trong file ý tưởng — slide và UI empty-state phải bám các câu này, không bịa pain mới:

1. **Thiếu dữ liệu toàn diện khi đánh giá** — thiếu hồ sơ, skill cứng/mềm, bằng cấp, dự án (domain, stack, vai trò), thành tích, hoạt động ngoài việc.
2. **Gián đoạn khi quản lý đổi** — PM nghỉ gần kỳ đánh giá → quản lý mới và HR không đủ chiều sâu để đánh giá công bằng.
3. **Staffing thủ công** — BOD/sales cần người theo tech + năm kinh nghiệm + domain → hỏi DC lead → PM nhớ, không có chỗ tra cứu.
4. **Nhân sự không có kênh tự ghi nhận** — giải thưởng, hackathon, thể thao, thiện nguyện… dễ bị bỏ sót nếu chỉ chờ HR/QL nhập.
5. **Không có lộ trình phát triển rõ** — muốn được ghi nhận nhưng không biết cần học gì cho khớp định hướng tổ chức.
6. **Chưa có bài test đầu vào / theo level chuẩn hóa** — *ngoài MVP cuộc thi*; ghi nhận là pain thật nhưng không demo trong hackathon.

---

## 3. Thị trường ngắn & USP

Cần so sánh ngắn với giải pháp tương tự (ưu/nhược, mình khác ở đâu) — đưa vào slide.

| Loại | Làm được | Thiếu so với CareerMate |
|---|---|---|
| Đánh giá KPI / 360 theo kỳ | Điểm tại một thời điểm | Không giữ được bối cảnh dự án, mất dữ liệu khi PM nghỉ |
| HRIS / Excel hồ sơ | HR nhập hộ | Nhân sự không tự ghi nhận; không hỏi-đáp ngôn ngữ tự nhiên |
| LinkedIn | Hồ sơ cá nhân | Không có đánh giá nội bộ, không có lịch sử dự án nội bộ / domain / đóng góp |
| Chatbot HR chung | Hỏi-đáp | Không gắn hồ sơ năng lực thật; không phải “thứ mới” |

**USP (nói được và demo được):**

1. **Hồ sơ xuyên suốt, không nằm trong đầu người quản lý** — dự án (vai trò, domain, stack, đóng góp), skill, thành tích, đánh giá tháng nằm trên hệ thống; PM nghỉ vẫn đánh giá được.
2. **Hai chiều: tổ chức đánh giá + nhân sự tự ghi nhận / tự đánh giá** — không chỉ top-down.
3. **Công ty tự dựng bộ tiêu chí** (nhóm, trọng số, câu 1–10); snapshot khi duyệt để số liệu quá khứ không bị sửa ngược.
4. **Staffing bằng ngôn ngữ tự nhiên** trên đúng hồ sơ nội bộ — ví dụ: *“ai có kinh nghiệm React trên 2 năm và từng làm domain bất động sản”*.
5. **AI xuyên nhiều điểm chạm**, không phải một chatbot: extract CV/LinkedIn, gợi ý lộ trình thành cột mốc đo được, đề xuất người cho dự án.

Mọi tính năng mới phải phục vụ pain + USP trên. Không làm “cái cũ chạy trên AI cho nhanh”.

---

## 4. Product design — không tham lam

MVP **nhỏ nhưng sài xướng**, giải quyết đúng 3 tình huống: đánh giá khi PM đã đi, nhân sự tự xây hồ sơ, staffing bằng câu hỏi. Màn rối / phi logic / khó xài bị trừ điểm.

### Trong cuộc thi (khớp mục 4 file Word)

1. **Hồ sơ năng lực** — timeline + thông tin cá nhân, kỹ năng, bằng cấp, dự án (vai trò, domain, stack, đóng góp), thành tích. Import CV / link giới thiệu (LinkedIn) → AI trích xuất → user chọn → apply. *Không lưu file gốc / ảnh CCCD* (dự án không có object storage — `CLAUDE.md`); chỉ lưu text đã extract.
2. **Cross Assessment hàng tháng** — tâm trạng + điểm nổi bật + trả lời theo thang 1–10. Quản lý/đồng nghiệp ghi nhận thêm; người có quyền duyệt.
3. **Chức năng xây dựng tiêu chí đánh giá** — Admin dựng nhóm tiêu chí, trọng số, câu hỏi, thang 1–10. Sửa template kỳ sau không làm sai bài đã duyệt (snapshot).
4. **Trợ lý hỏi-đáp** — tìm nhân sự phù hợp; với nhân sự thì đồng hành gợi ý phát triển. Một luồng chat, không phải portal thứ ba.
5. **Lộ trình phát triển** — AI đề xuất cột mốc + nhiệm vụ đo được + mốc thời gian; user lưu mới persist.

### Sau cuộc thi (có trong file ý tưởng, không đụng trừ khi được yêu cầu)

- Lịch sử đào tạo đầy đủ: tạo khóa, link đăng ký, điểm danh, nhận xét buổi học, **đề xuất khóa học bằng AI**
- Goal Tracker 2 nhóm (công việc / đời sống) với % tiến độ — file Word xếp *sau cuộc thi*
- Bài test năng lực theo level / tiếng Anh
- Minh chứng thành tích bằng ảnh (cần storage)
- Tích hợp HR ngoài

**Rule khi code:** trước khi thêm màn / endpoint / model, hỏi “có trong 5 mục cuộc thi không?”. Không thì dừng. Theme concept (anime/film/pixel) không phải câu chuyện pitch.

### Nhiều portal / nhiều actor

Ba cửa vào cùng một nguồn sự thật (hồ sơ năng lực):

| Actor | Không gian | Việc trong demo |
|---|---|---|
| Company Admin / HR | Roster, template tiêu chí, duyệt đánh giá, hỏi assistant staffing | Dựng tiêu chí, duyệt bài, hỏi tìm người |
| Employee | Hồ sơ, import, tự đánh giá, lộ trình | Import CV, tự đánh giá tháng, xem roadmap |
| Sales / BOM / PM | Cùng login, chủ yếu assistant | Đặt câu NLQ, nhận list xếp hạng |

Workflow phải **khép kín và đúng chiều**:

Hồ sơ (import hoặc nhập) → Admin mở kỳ + template → Employee tự đánh giá → QL/đồng nghiệp bổ sung → duyệt → dữ liệu nằm lại trên hồ sơ → assistant/staffing đọc được.

Không trộn nút Admin vào màn Employee. Demo **một người, một tháng đánh giá, một câu hỏi staffing** — không nhảy 6 module rời.

---

## 5. AI integrated

Hai khía cạnh, cả hai đều bắt buộc:

1. Dùng AI để **build nhanh** (code, slide) — người kiểm soát nội dung, không để câu sáo / lệch pain point.
2. Sản phẩm **có AI** để ra **thứ mới**: hồ sơ tự dựng từ CV, staffing bằng câu nói thường, lộ trình đo được — không phải form đánh giá cũ bọc chatbot.

AI chỉ gắn chỗ **tăng tự động hóa, giảm nhập tay, collect/import dữ liệu**:

| Việc | AI làm | Người làm |
|---|---|---|
| Import CV / LinkedIn | Parse → skill, cert, project, award có cấu trúc | Chọn mục apply |
| Lộ trình phát triển | Cột mốc + task đo được | Sửa và save |
| Staffing / assistant | Rank người khớp câu NLQ | Đọc list, không ghi DB |
| Career summary (nếu có trong luồng passport nội bộ) | Tóm tắt kỳ làm việc | Review rồi save |

Không nhét AI vào CRUD thuần hay form điểm 1–10.

### Token & chọn model

Mọi call qua `AiChatService`. Không gọi SDK provider trực tiếp.

- Việc dễ (extract field, JSON nhỏ, classify) → model rẻ.
- Việc khó (NLQ matching, roadmap) → model mạnh.
- Chỉ định provider/model theo vụ; đừng luôn default Anthropic.
- Prompt chỉ gửi context cần (danh sách skill/project liên quan, không dump cả công ty).

### Tiền xử lý & hậu xử lý (bắt buộc)

**Cấm** call AI rồi paste nguyên văn lên màn hình.

Trước: cắt CV/profile còn schema cần extract; không gửi PII thừa.

Sau: strip fence, parse JSON, validate shape, drop id/skill/user không có trong input. Trả proposal, **không ghi DB**. Persist ở endpoint riêng sau confirm. UI có chọn/checkbox. `BadGatewayException` chỉ khi reply vỡ/rỗng.

Pattern: `development-plans/generate` → save; import `parse` → `apply`; job-requirements `match` (read-only, không save).

---

## 6. UI / UX

**Lean · Visualize · Easy to use.**

| Tiêu chí | Áp vào CareerMate |
|---|---|
| **Lean** | Mỗi màn 1 việc. Hồ sơ = timeline + tab. Đánh giá = mood + nổi bật + câu hỏi. Assistant = một ô chat. |
| **Visualize** | Timeline sự nghiệp, lịch sử dự án (không chỉ tên dự án), điểm đánh giá theo tháng, list staffing có rank — không bắt user đọc JSON. |
| **Easy to use** | Nhìn vào biết xài. Import: dán/upload → đề xuất → chọn → lưu. Câu hỏi staffing đặt như nói chuyện. |

**Cấm:** màn nhồi, copy sáo, Admin/Employee lẫn control, empty state không nói bước tiếp theo.

Layout: `AppShell` + `PageContainer` + `PageHeader` + `Card`.

---

## 7. MVP demo

Demo nhỏ, **chạy xuyên**, giải quyết đúng câu chuyện mở đầu file Word.

Câu chuyện chuẩn (~3–5 phút):

1. **Hồ sơ:** Employee import CV/link → đề xuất AI → apply → timeline hiện skill, dự án (domain/stack), bằng cấp.
2. **Đánh giá không phụ thuộc PM:** Admin/HR mở kỳ với bộ tiêu chí công ty → Employee tự đánh giá (mood + nổi bật + thang 10) → duyệt. Nói rõ: dữ liệu này còn khi PM đã nghỉ.
3. **Staffing:** Sales/BOM/PM (hoặc Admin) hỏi *“ai có kinh nghiệm React trên 2 năm và từng làm domain bất động sản”* → list xếp hạng từ hồ sơ thật.
4. **Lộ trình (nếu còn giờ):** Employee generate roadmap → cột mốc đo được → save.

Nếu một trong 3 bước đầu vỡ: **sửa demo**, đừng thêm module (đào tạo, test level, goal tracker đời sống).

---

## 8. Presentation (10 phút)

Chưa cần GTM / doanh thu. **Cần tầm nhìn**. Slide có thể do AI làm — phải đọc lại từng câu, AI hay vẽ vời lệch pain point (PM nghỉ, staffing vòng vo).

### Nội dung bắt buộc

1. **Vấn đề, thị trường, giải pháp** — kể 2 tình huống mở đầu (PM nghỉ trước kỳ lương; BOD cần team phải hỏi DC lead → PM). Bảng mục 3. Giải pháp = hồ sơ xuyên suốt + đánh giá hai chiều + trợ lý staffing.
2. **Cái hay** — 5 USP; demo sống trên data seed, không slide giả.
3. **Thách thức / rủi ro** và hướng xử lý (điểm cộng): dữ liệu thiên lệch khi tự đánh giá (cần góc QL/đồng nghiệp + duyệt); nhân sự không chịu cập nhật hồ sơ (import CV cho nhẹ); chi phí token (model rẻ/khó); quyền riêng tư khi về sau share passport. Không giả vờ không có rủi ro.
4. **Tầm nhìn** — đồng hành cả đời làm việc tại công ty, rồi (sau này) mang theo hành trình khi chuyển việc. Không phóng đại thành mạng xã hội nghề nghiệp.
5. **Roadmap sơ bộ:**
   - **Now:** 5 mục cuộc thi (hồ sơ + import, cross assessment, template tiêu chí, assistant, lộ trình).
   - **Next:** goal tracker 2 nhóm, thành tích kèm minh chứng, lịch sử đào tạo.
   - **Later:** đề xuất khóa học, test theo level, tích hợp HR — ghi rõ *ngoài cuộc thi*.

### Slide

- 1 slide = 1 ý. Không đoạn văn.
- Dùng đúng ví dụ trong file ý tưởng (React + domain bất động sản; PM nghỉ trước kỳ lương). Không slogan không demo được.
- Số liệu thị trường không có nguồn thì không bịa.

---

## 9. Checklist trước khi merge / trước khi demo

- [ ] Phục vụ pain trong file ý tưởng (đánh giá đủ dữ liệu, không đứt khi đổi QL, staffing NLQ, tự ghi nhận, lộ trình).
- [ ] Không thêm module “sau cuộc thi” (khóa học, test level, goal đời sống, ảnh CCCD).
- [ ] Luồng HR ↔ Employee ↔ người staffing khép kín trên cùng hồ sơ.
- [ ] AI: proposal → confirm; tiền/hậu xử lý; model theo độ khó; không paste raw.
- [ ] UI lean, timeline/dự án/điểm tháng nhìn được, nhìn vào biết xài.
- [ ] Demo 3 bước đầu mục 7 chạy trên seed: Alice/Bob + admin Acme.
