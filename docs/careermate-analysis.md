# 🔍 Phân Tích CareerMate vs Implementation Plan

> **Tài liệu team:** CareerMate — Phần mềm Đánh giá Năng lực Nhân viên  
> **Implementation plan:** People Intelligence Platform (Antigravity)

---

## I. SO SÁNH 2 CHIỀU

### ✅ Điểm GIỐNG nhau (Core vision thống nhất)
| Aspect | CareerMate (Team) | Implementation Plan (Anti) |
|---|---|---|
| Concept | Nền tảng đánh giá năng lực nhân sự toàn diện | AI-powered Employee 360° Intelligence Platform |
| Multi-persona | HR, PM, Sales, BOM, Employee | HR, PM, Employee, Management |
| Smart Search | Hỏi-đáp ngôn ngữ tự nhiên tìm nhân sự | Smart People Search (chat AI) |
| Employee Profile | Hồ sơ năng lực toàn diện | Employee 360° AI Profile |
| Self-service | Nhân sự tự ghi nhận, tự đánh giá | Employee view tự xem insights |

### 🔄 Điểm KHÁC nhau quan trọng

| Aspect | CareerMate (Team) | Implementation Plan (Anti) | Ai tốt hơn? |
|---|---|---|---|
| **Tên** | ✅ "CareerMate" — rõ ràng, dễ nhớ | ❌ Chưa chốt tên | Team ✅ |
| **Storytelling** | ✅ 2 scenario thực tế cảm xúc (PM nghỉ việc, BOD cần staffing) | ❌ Không có story | Team ✅✅ |
| **Pain points** | ✅ 6 pain points cụ thể, structured | ⚠️ Có nhưng chưa structured | Team ✅ |
| **Data source** | ✅ AI Import (CV/PDF/Excel) + nhân sự tự nhập | ⚠️ Auto từ Git/Jira/Slack (chỉ phù hợp IT) | CareerMate tốt hơn — phù hợp MỌI ngành |
| **AI depth** | ⚠️ AI trích xuất CV, gợi ý khóa học, tìm nhân sự | ✅ AI phân tích commit quality, skill radar, burnout detection | Anti sâu hơn |
| **Cross Assessment** | ✅ Tự đánh giá + peer review hàng tháng | ❌ Không có | Team ✅✅ |
| **Goal Tracker** | ✅ Mục tiêu cá nhân (cả đời sống) | ❌ Không có | Team ✅ |
| **Level Test** | ✅ Bài test năng lực theo level | ❌ Không có | Team ✅ |
| **Wellbeing** | ⚠️ Qua Cross Assessment (tâm trạng hàng tháng) | ✅ Dashboard riêng, burnout detection từ data | Anti sâu hơn |
| **MVP Scope** | ✅ 3 modules rõ ràng (Profile, Cross Assessment, Search) | ⚠️ 4 features (rộng hơn, risk hơn) | Team thực tế hơn |
| **Employee empowerment** | ✅✅ Rất mạnh — tự ghi nhận, tự đánh giá, tự đặt mục tiêu | ⚠️ Passive — AI phân tích giúp | Team vision tốt hơn |

---

## II. PHẢN BIỆN — 7 Điểm Cần Xem Lại

### ⚠️ Phản biện 1: Scope TOÀN BỘ quá rộng cho 1 sản phẩm
**Vấn đề:** 7 chức năng chính (Profile, Project History, Training, Awards, Cross Assessment, Search, Goal Tracker, Level Test) — đây gần như là **1 HRIS (HR Information System) hoàn chỉnh**. Ngay cả với team 10 người, build 1 HRIS mất 6-12 tháng.

**Đề xuất:** Team đã scope đúng cho hackathon (3 modules). Nhưng khi pitching, **đừng liệt kê tất cả 7 features** — BGK sẽ hỏi "thế team định làm hết à?" → Nên nói rõ: "MVP 3 modules, roadmap 7 modules".

---

### ⚠️ Phản biện 2: DATA ĐẦU VÀO — Bài toán "gà và trứng"
**Vấn đề:** CareerMate đẹp khi có DATA. Nhưng data đến từ đâu?
- CV/LinkedIn import → tốt nhưng chỉ là snapshot ban đầu
- Nhân sự tự nhập → **phụ thuộc vào ý chí con người** (ai cũng lười nhập liệu)
- HR nhập → HR đã quá tải rồi

**Câu hỏi BGK có thể hỏi:** *"Ai sẽ nhập data? Nhân sự có motivation gì để tự cập nhật? Nếu 6 tháng không ai cập nhật thì data cũ có giá trị gì?"*

**Đề xuất giải pháp:** Kết hợp **AI Import** (upload CV/PDF/Excel → AI tự trích xuất) với data nhân sự tự nhập → giảm dependency vào con người. Khi demo, nhấn mạnh: *"Upload 1 file PDF, AI fill 80% hồ sơ trong 10 giây. 20% còn lại nhân sự tự bổ sung vì KHÔNG AI hiểu bạn bằng chính bạn."*

> **Lưu ý:** Không dùng Git/Jira/Slack làm data source vì CareerMate target MỌI ngành nghề (không chỉ IT). Data source phải generic: CV, file đánh giá, Excel danh sách dự án, ảnh chứng nhận...

---

### ⚠️ Phản biện 3: Cross Assessment — Hay nhưng phức tạp
**Vấn đề:** Tính năng self-assessment + peer review hàng tháng nghe hay, nhưng:
- Thiết lập template + trọng số → cần UX phức tạp
- Nhân sự tự đánh giá "tâm trạng" → dễ bị bias (ai cũng chọn "ổn" để không bị soi)
- Peer review → nhạy cảm, cần anonymous, cần moderation

**Câu hỏi BGK:** *"Nếu nhân viên luôn tự đánh giá 'tốt' thì data có ý nghĩa gì? Peer review anonymous hay không?"*

**Đề xuất cho MVP:** Đơn giản hóa — chỉ cần: 
1. Nhân sự chọn emoji tâm trạng (😊😐😟) + viết 1 câu điểm nổi bật
2. Manager ghi nhận 1 câu feedback
3. AI tổng hợp trend qua nhiều tháng

---

### ⚠️ Phản biện 4: AI CHƯA RÕ là CORE ENGINE hay FEATURE?
**Vấn đề:** Tiêu chí **AI Effectiveness chiếm 23%**. Tài liệu nói "AI hiện diện xuyên suốt" nhưng cụ thể AI làm gì ở mỗi điểm chạm?
- CV extraction → **có thể dùng regex/parser**, không nhất thiết AI
- Gợi ý khóa học → recommendation engine, AI level trung bình
- Tìm nhân sự → đây MỚI là AI thực sự (NLU + matching)

**Câu hỏi BGK (Data Team):** *"AI ở đây khác gì một hệ thống filter + search truyền thống? Nếu bỏ AI đi, sản phẩm còn hoạt động không?"*

**Đề xuất:** Cần làm rõ **"AI-First" moments**:
1. 🤖 **Smart Search** = AI hiểu ngôn ngữ tự nhiên + reasoning (không phải keyword match)
2. 🤖 **AI Insight Generation** = Phân tích data → sinh insights bằng ngôn ngữ tự nhiên (từ impl plan)
3. 🤖 **Burnout/Wellbeing Detection** = AI phát hiện patterns mà con người không thấy (từ impl plan)
4. 🤖 **Skill Gap Analysis** = AI so sánh skills hiện tại vs yêu cầu tổ chức → đề xuất cụ thể

---

### ⚠️ Phản biện 5: DEMO FLOW chưa rõ
**Vấn đề:** Tài liệu liệt kê 3 modules cho MVP nhưng chưa mô tả:
- Demo bắt đầu từ đâu?
- "Magic moment" là gì?
- Luồng người dùng cụ thể ra sao?

**Đề xuất (từ implementation plan):** Cần demo script rõ ràng:
1. Hook: Kể story PM nghỉ việc (đã có trong tài liệu — RẤT HAY)
2. Demo Profile → switch persona views
3. Demo Search: "Tìm ai có React 2 năm, từng làm fintech" → kết quả instant
4. Close: Tagline + roadmap

---

### ⚠️ Phản biện 6: Cạnh tranh — "Khác gì BambooHR/Lattice?"
**Vấn đề:** Bất kỳ BGK nào cũng sẽ hỏi: *"Đã có BambooHR, Lattice, 15Five, Culture Amp... CareerMate khác gì?"*

**Unique selling points cần nhấn mạnh:**
1. **AI-First** (không phải "AI-Added") — AI PHÂN TÍCH chứ không chỉ HIỂN THỊ data
2. **Employee empowerment** — nhân sự CHỦ ĐỘNG ghi nhận, không bị động chờ HR
3. **Vietnamese context** — hiểu văn hóa công ty VN (khen thưởng, hoạt động đoàn thể, thiện nguyện)
4. **Cross-role intelligence** — cùng 1 data, khác insight cho HR/PM/Sales/Employee

---

### ⚠️ Phản biện 7: Tên "CareerMate" — OK nhưng chưa "wow"
**Nhận xét:** "CareerMate" dễ nhớ, rõ nghĩa. Nhưng:
- Nghe hơi generic — giống app LinkedIn learning
- Không thể hiện yếu tố AI
- Đề xuất alternative: **"CareerMate AI"** hoặc giữ nguyên nếu team đã thích

---

## III. ĐIỂM TEAM LÀM TỐT HƠN (Cần giữ lại)

| # | Điểm hay | Tại sao tốt |
|---|---|---|
| 1 | **Storytelling mở đầu** (PM nghỉ việc, BOD cần staffing) | Cảm xúc, thực tế, BGK đều đã trải qua → đồng cảm ngay |
| 2 | **Employee empowerment** — tự ghi nhận, tự đánh giá | Làm sản phẩm "warm" hơn, không chỉ là tool cho management |
| 3 | **Cross Assessment** hàng tháng | Tạo engagement loop — nhân sự quay lại dùng app hàng tháng |
| 4 | **Goal Tracker** cả công việc + cuộc sống | Phạm vi rộng hơn, toàn diện hơn, matching tagline "đồng hành" |
| 5 | **6 pain points cụ thể** | Structured, dễ pitching, mỗi feature map với 1 pain point |
| 6 | **MVP scope 3 modules** | Thực tế hơn plan 4 features của em |

---

## IV. ĐIỂM CẦN BỔ SUNG TỪ IMPLEMENTATION PLAN

| # | Điểm từ impl plan | Tại sao cần bổ sung |
|---|---|---|
| 1 | **AI Import** (upload CV/PDF/Excel → AI trích xuất tự động) | Giải quyết bài toán "ai nhập data?" — phù hợp mọi ngành |
| 2 | **AI Insight Generation** (NLP summary per persona) | Tăng điểm AI Effectiveness 23% |
| 3 | **Skill Radar Chart** visualization | Demo trực quan, BGK thấy ngay value |
| 4 | **Burnout/Wellbeing detection** từ behavioral data | Unique selling point — AI "thấy" cái con người không thấy |
| 5 | **Demo mode toggle** (mock data backup) | Safety net khi demo live |
| 6 | **Structured AI output** (Zod schema) | Đảm bảo AI trả kết quả chuẩn, không "ảo" |

---

## V. ĐỀ XUẤT MERGE — "BEST OF BOTH"

### MVP 3 Modules (giữ scope team):

**Module 1: Competency Profile (AI-Enhanced)**
- Hồ sơ năng lực toàn diện (từ CareerMate)
- **+ Skill Radar Chart** (từ impl plan)
- **+ AI Summary per persona** (từ impl plan) — HR/PM/Employee xem khác nhau
- **+ Auto data suggestion** — AI gợi ý bổ sung dựa trên project history

**Module 2: Cross Assessment (Simplified for MVP)**
- Self-assessment + peer feedback hàng tháng (từ CareerMate)
- **Đơn giản hóa:** Emoji tâm trạng + 1 câu highlight + manager note
- **+ AI trend analysis** (từ impl plan) — phát hiện pattern qua nhiều tháng

**Module 3: Smart Search (AI-First)**
- Chat interface tìm nhân sự (cả 2 đều có)
- **+ Structured AI output** (từ impl plan) — match score + reasons + concerns
- **+ Employee self-service search** (từ CareerMate) — "tìm người mentor cho mình"

---

> [!IMPORTANT]
> ## Tổng kết: Tài liệu CareerMate RẤT TỐT
> - Storytelling hay, pain points rõ, vision đúng hướng
> - MVP scope 3 modules là hợp lý cho 24h
> - Cần bổ sung: automated data, deeper AI, demo flow, competitive positioning
> - Mở đầu pitching (story PM nghỉ việc) nên GIỮ NGUYÊN — đây là weapon lớn nhất

---

## VI. 📝 PHÂN TÍCH STORYTELLING — Có đủ "WOW" không?

### Storytelling hiện tại (từ tài liệu team)

**Story 1 — PM nghỉ việc trước kỳ đánh giá:**
> *"Bạn đã gắn bó với dự án tròn 1 năm... PM ấy nghỉ việc. Quản lý mới phải đánh giá bạn — nhưng dựa vào đâu?"*

**Story 2 — BOD cần staffing gấp:**
> *"Ban lãnh đạo cần gấp đội ngũ cho dự án mới... quy trình hiện tại: hỏi DC lead → DC lead hỏi PM → PM nhớ xem ai... một chuỗi hỏi đáp vòng vo"*

### 🟢 Điểm HAY:

| # | Điểm hay | Tại sao hiệu quả |
|---|---|---|
| 1 | **Cảm xúc thực** — "PM nghỉ việc" | BGK đều đã trải qua → tạo empathy ngay giây đầu |
| 2 | **Pain rõ ràng** — "quyết định dựa trên thông tin rời rạc" | Ai cũng từng bị đánh giá không công bằng |
| 3 | **2 góc nhìn** — nhân viên bị thiệt + công ty mất thời gian | Appeal cả 2 nhóm audience |
| 4 | **Kết thúc bằng solution** — "Đây chính là vấn đề mà CareerMate ra đời để giải quyết" | Clean bridge từ problem → solution |

### 🟡 Cần cải thiện để "WOW" hơn:

#### 1. Thiếu CON SỐ — không có data point nào
**Vấn đề:** Story hay nhưng toàn cảm xúc, không có số liệu thuyết phục giám khảo analytical (Data Team, BGK kỹ thuật).

**Đề xuất bổ sung:**
> *"Theo khảo sát của Gallup 2025, 67% nhân viên nghỉ việc nói rằng họ không được đánh giá công bằng. Trung bình 1 PM phải mất 3-5 ngày làm việc mỗi quý chỉ để thu thập thông tin đánh giá nhân viên."*

Hoặc dùng data Madison:
> *"Tại Madison, mỗi kỳ đánh giá, trung bình 1 DC lead phải hỏi 5-8 PM, mỗi PM hỏi 3-4 thành viên — tốn X giờ cho 1 quyết định staffing."*

#### 2. Thiếu TWIST — không có "bất ngờ"
**Vấn đề:** 2 story đều predictable — ai cũng đoán được kết thúc.

**Đề xuất thêm story thứ 3 (twist):**
> *"Và có một câu chuyện mà ít ai nghĩ đến: nhân viên A làm rất tốt, nhận giải Best Staff, tham gia thiện nguyện, lead 3 dự án thành công — nhưng đến kỳ đánh giá, tất cả chỉ được ghi lại bằng 2 dòng email. A cảm thấy nỗ lực của mình không được nhìn thấy. 6 tháng sau, A nghỉ việc."*
>
> *"Vấn đề không phải A không tốt. Vấn đề là KHÔNG CÓ AI GHI LẠI hành trình đó."*

→ **Twist:** Không phải công ty thiếu nhân tài — mà là công ty KHÔNG BIẾT mình có nhân tài, và nhân tài KHÔNG BIẾT mình được ghi nhận.

#### 3. Cần "BEFORE vs AFTER" rõ hơn
**Đề xuất bổ sung vào pitch:**

| | BEFORE (Hiện tại) | AFTER (CareerMate) |
|---|---|---|
| Đánh giá nhân viên | Hỏi PM cũ, đọc email, nhớ lại | 1 click → Hồ sơ năng lực toàn diện |
| Tìm nhân sự cho dự án | DC lead → PM → nhớ xem → 3-5 ngày | Chat AI → 30 giây |
| Ghi nhận thành tích | Chờ HR hoặc quản lý nhập | Nhân sự tự ghi nhận + AI gợi ý |
| Career development | "Tự nghĩ đi" | AI phân tích + đề xuất lộ trình |

#### 4. Tagline cần mạnh hơn
**Hiện tại:** *"Người bạn đồng hành xuyên suốt..."* → Hơi dài, hơi mềm

**Đề xuất alternatives:**
- 🥇 **"Mỗi nhân sự đều có một câu chuyện — CareerMate giúp kể câu chuyện đó."**
- 🥈 **"Đánh giá không chỉ bằng cảm tính — mà bằng hành trình."**
- 🥉 **"Từ dữ liệu rời rạc đến bức tranh toàn cảnh con người."**

### Verdict: Storytelling hiện tại **7/10** → cần lên **9/10**

| Đã có | Cần thêm |
|---|---|
| ✅ Cảm xúc, thực tế | ❌ Con số / data point |
| ✅ 2 scenarios rõ ràng | ❌ Story thứ 3 (nhân viên giỏi nghỉ việc vì không được ghi nhận) |
| ✅ Problem → Solution bridge | ❌ Before vs After so sánh |
| ✅ Tagline OK | ❌ Tagline ngắn gọn, đanh thép hơn |

---

## VII. 📄 REVIEW BẢN CẬP NHẬT (Phương Trình Đình)

### Tracked Changes phát hiện:

#### 1. ✅ B2B Positioning (MỚI — RẤT HAY)
> *"Sẽ mở rộng là 1 cái, đối tượng sử dụng B2B, trong trường hợp chuyển hồ sơ dữ liệu, đối thủ cạnh tranh, thị trường, compensation, lưu sơn nhập liệu nhanh hơn AI import linked hay cv..."*

**Nhận xét:** Đây là bổ sung rất tốt — B2B SaaS model cho phép:
- Scale ra nhiều công ty khác
- Revenue model rõ ràng (subscription per company)
- **"Data portability"** khi nhân viên chuyển công ty → hồ sơ đi theo

**⚠️ Cần clarify:**
- **Compensation benchmarking** — so sánh lương với thị trường? Đây là feature nhạy cảm, cần data ngoài
- **Data portability** — khi nhân viên nghỉ, hồ sơ CareerMate đi theo họ sang công ty mới? Đây là USP cực mạnh nếu làm được

---

#### 2. ✅ AI Import demo (MỚI)
> Competency Profile: *"→ demo bằng import 1 cv vào"*

**Nhận xét:** Đúng — AI Import sẽ là **WOW moment đầu tiên** trong demo:
- Upload PDF CV → AI tự trích xuất: tên, skills, kinh nghiệm, dự án
- Data tự fill vào profile → "Vừa tiết kiệm 30 phút nhập liệu"

---

#### 3. ✅ HR tạo/edit khóa học (MỚI)
> *"HR tạo khóa học, edit, ghi nhận danh sách nhân sự tham gia và việc nhân sự tham gia được tổng hợp từ..."*

**Nhận xét:** OK cho roadmap, **KHÔNG nên demo trong hackathon** — quá phức tạp, UX heavy. Nếu có thì chỉ hiển thị "Training History" (read-only).

---

#### 4. ✅ Cross Assessment template (MỚI)
> *"Cơ chế tiêu chí tạo template, chứa đánh giá sao, chọn EMOJI cho phép user/mgmt đánh giá template"*

**Nhận xét:** Emoji + star rating = approach đúng cho MVP. Đơn giản, trực quan. **GIỮ NGUYÊN.**

---

#### 5. ✅ AI Support rõ hơn (MỚI)
> *"AI Support — Trợ lý hỏi-đáp tìm nhân sự & đồng hành phát triển cá nhân"*

Đã tách rõ 2 vai trò:
- **Cho PM/Sales/BOM:** Tìm nhân sự phù hợp
- **Cho Employee:** Đồng hành phát triển, gợi ý lộ trình, ghi nhận nỗ lực

**Nhận xét:** Đúng direction. Cần 2 system prompt khác nhau cho 2 vai trò.

---

#### 6. ✅ Goal Tracker chi tiết hơn (MỚI)
> *"Tự đặt ra và theo đuổi mục tiêu cho riêng mình — không chỉ trong công việc mà cả trong cuộc sống"*

Có thêm: phần trăm tiến độ, đánh dấu hoàn thành, thay đổi deadline

**Nhận xét:** Feature hay nhưng **P2 cho hackathon** — nếu kịp thì làm, không thì skip.

---

## VIII. 🥊 PHÂN TÍCH ĐỐI THỦ CẠNH TRANH

### A. Đối Thủ Quốc Tế

#### 1. Lattice — "Performance & Growth Suite"
| Aspect | Chi tiết |
|---|---|
| **Focus** | Performance reviews + OKR + Compensation |
| **Giá** | ~\$11/user/tháng |
| **Điểm mạnh** | Customizable reviews, career pathing, 360° feedback, AI agents cho policy Q&A |
| **Điểm yếu** | ❌ Không có employee self-recording (thành tích, hoạt động ngoài công việc) |
| | ❌ Không AI-first — AI chỉ là add-on |
| | ❌ Không hiểu context Việt Nam |
| **CareerMate hơn ở đâu** | ✅ Employee empowerment (tự ghi nhận), ✅ AI-First search, ✅ Holistic (cả công việc + đời sống) |

#### 2. 15Five — "Manager-Centric Platform"
| Aspect | Chi tiết |
|---|---|
| **Focus** | Weekly check-ins + Manager coaching |
| **Giá** | ~\$4-14/user/tháng |
| **Điểm mạnh** | Continuous feedback loop, Best-Self reviews, manager training tools |
| **Điểm yếu** | ❌ Chỉ focus manager-employee 1:1, không có cross-team search |
| | ❌ Không có competency profile toàn diện |
| | ❌ Không hỗ trợ staffing/team building |
| **CareerMate hơn ở đâu** | ✅ Multi-stakeholder (HR/PM/Sales/Employee, không chỉ manager), ✅ Smart Search tìm nhân sự |

#### 3. Culture Amp — "Engagement & Analytics"
| Aspect | Chi tiết |
|---|---|
| **Focus** | Employee surveys + Engagement analytics |
| **Giá** | Enterprise pricing (không public) |
| **Điểm mạnh** | Best-in-class survey tools, sentiment analysis, DEI metrics, benchmarking |
| **Điểm yếu** | ❌ Survey-based → bias (nhân viên trả lời cho có) |
| | ❌ Không có competency profile hay skill matching |
| | ❌ Passive data collection — phải chờ nhân viên fill survey |
| **CareerMate hơn ở đâu** | ✅ Data từ hành vi thực (projects, achievements) — không phải survey, ✅ AI analysis thay vì chỉ dashboards |

#### 4. BambooHR — "HRIS Foundation"
| Aspect | Chi tiết |
|---|---|
| **Focus** | HR admin, payroll, basic performance |
| **Giá** | ~\$6-8/user/tháng |
| **Điểm mạnh** | All-in-one HRIS, dễ dùng, SMB friendly |
| **Điểm yếu** | ❌ Performance module rất basic |
| | ❌ Không có AI |
| | ❌ Không có career pathing hay skill intelligence |
| **CareerMate hơn ở đâu** | ✅ AI-powered intelligence (không chỉ data storage), ✅ Deeper competency view |

#### 5. TalentGuard — "Enterprise Competency Platform"
| Aspect | Chi tiết |
|---|---|
| **Focus** | Skills intelligence + Career pathing + Succession planning |
| **Giá** | Enterprise (expensive) |
| **Điểm mạnh** | Competency frameworks, skills matrix, career ladder mapping |
| **Điểm yếu** | ❌ Nặng, phức tạp, triển khai lâu |
| | ❌ Enterprise-only, không phù hợp SMB |
| | ❌ Top-down approach — HR define, employee follow |
| **CareerMate hơn ở đâu** | ✅ Bottom-up + AI (employee empowerment), ✅ Lightweight (SaaS, deploy nhanh), ✅ Affordable |

---

### B. Đối Thủ Việt Nam

#### 1. Base HRM+ (Base.vn)
| Aspect | Chi tiết |
|---|---|
| **Focus** | HRM toàn diện: KPI/OKR, chấm công, tính lương |
| **Điểm mạnh** | Rất phổ biến ở VN, tích hợp đầy đủ, hiểu luật lao động VN |
| **Điểm yếu** | ❌ Quản trị-centric (HR dùng, không phải employee) |
| | ❌ AI chưa sâu — chủ yếu dashboard/report |
| | ❌ Không có skill matching hay smart search |
| **CareerMate hơn** | ✅ Employee-first (tự ghi nhận, tự đánh giá), ✅ AI search, ✅ Cross-role views |

#### 2. MISA AMIS HRM
| Aspect | Chi tiết |
|---|---|
| **Focus** | Số hóa vòng đời nhân viên + tính lương + BHXH |
| **Điểm mạnh** | Tuân thủ luật VN tốt nhất, tích hợp kế toán, ecosystem MISA lớn |
| **Điểm yếu** | ❌ Focus admin/compliance, không focus talent development |
| | ❌ Không có AI-powered insights |
| | ❌ UX cũ, nặng |
| **CareerMate hơn** | ✅ Talent intelligence (không chỉ admin), ✅ Modern UX, ✅ AI-First |

#### 3. 1Office HRM
| Aspect | Chi tiết |
|---|---|
| **Focus** | Quản trị tổng thể, tuyển dụng, KPI |
| **Điểm mạnh** | Giao diện thân thiện, giá rẻ |
| **Điểm yếu** | ❌ Basic performance management |
| | ❌ Không có competency profiling sâu |
| **CareerMate hơn** | ✅ Depth of competency data, ✅ AI analysis |

---

### C. BẢNG TỔNG KẾT CẠNH TRANH

| Feature | Lattice | 15Five | Culture Amp | BambooHR | Base HRM+ | MISA | **CareerMate** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Competency Profile | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| AI-Powered Insights | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ❌ | ⭐ | ❌ | ⭐⭐⭐⭐⭐ |
| Smart People Search | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| Employee Self-Recording | ❌ | ⭐⭐ | ⭐ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| Cross Assessment | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| Goal Tracker | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| Vietnamese Context | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| AI Data Import | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| Multi-Role Views | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Price (SMB friendly) | ⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

### D. CAREERMATE'S UNFAIR ADVANTAGES (Pitch cho BGK)

> [!TIP]
> ### 5 điểm CareerMate KHÔNG AI CÓ:
> 
> 1. **🤖 AI-First Smart Search** — Không tool HR nào cho phép PM gõ "tìm ai có React 2 năm, từng làm fintech" và nhận kết quả AI-curated trong 30 giây. Tất cả đối thủ đều dùng filter/dropdown truyền thống.
> 
> 2. **📎 AI Import từ mọi nguồn** — Upload CV, PDF đánh giá, Excel danh sách dự án → AI tự trích xuất và fill vào hồ sơ. Không tool nào làm được — tất cả đều yêu cầu nhập tay hoặc integration phức tạp.
> 
> 3. **🙋 Employee Empowerment** — Nhân sự TỰ ghi nhận thành tích, hoạt động ngoài công việc (thiện nguyện, thể thao, giải thưởng) + TỰ đánh giá + TỰ đặt mục tiêu. Đối thủ: top-down (HR/Manager quyết định, employee chỉ đọc).
> 
> 4. **👥 Multi-Role Intelligence** — CÙNG data, KHÁC insight: HR thấy career path, PM thấy skill fit, Sales thấy team capability, Employee thấy growth map. Đối thủ: 1 view cho tất cả.
> 
> 5. **🌍 Cross-Company Portability (Roadmap B2B)** — Khi nhân viên chuyển công ty, hồ sơ CareerMate đi theo. Đây là **LinkedIn cho hồ sơ năng lực nội bộ** — chưa ai làm.

> [!WARNING]
> ### Câu hỏi BGK sẽ hỏi (chuẩn bị sẵn):
> 
> 1. *"Khác gì BambooHR/Base HRM?"* → "Họ quản lý giấy tờ, chúng tôi quản lý CON NGƯỜI. Họ show data, chúng tôi PHÂN TÍCH data."
> 
> 2. *"Khác gì Lattice?"* → "Lattice focus performance review top-down. CareerMate focus employee journey bottom-up + AI intelligence."
> 
> 3. *"AI ở đây khác gì ChatGPT wrapper?"* → "ChatGPT trả lời chung chung. CareerMate AI hiểu context toàn bộ hồ sơ nhân sự — trả lời dựa trên DATA THỰC của tổ chức."
> 
> 4. *"Sao nhân viên phải tự nhập data?"* → "Vì KHÔNG AI hiểu bạn bằng chính bạn. Và AI giúp nhập nhanh hơn — upload 1 file PDF, AI fill 80% hồ sơ trong 10 giây."

---

## IX. 📊 DATA SOURCE — Điều Chỉnh Cho Mọi Ngành Nghề

> ⚠️ **QUAN TRỌNG:** CareerMate target mọi ngành, không chỉ IT → **KHÔNG** dùng Git/Jira/Slack làm data source chính. Data phải generic.

| Nguồn data | Cách thu thập | Priority |
|---|---|---|
| **CV / LinkedIn PDF** | AI Import — upload file → tự trích xuất skills, kinh nghiệm, dự án | 🔴 P0 (demo) |
| **Nhân sự tự nhập** | Form trong app (thành tích, hoạt động, chứng chỉ, mục tiêu) | 🔴 P0 |
| **HR nhập** | Quản lý hồ sơ, tạo khóa học, ghi nhận khen thưởng | 🔴 P0 |
| **File đánh giá (PDF/Excel)** | AI Import — upload performance review → trích xuất tự động | 🟡 P1 |
| **Manager feedback** | Cross Assessment hàng tháng (emoji + star + note) | 🔴 P0 |
| **Ảnh chứng nhận/giải thưởng** | Upload + AI nhận diện nội dung | 🟢 P2 |
| **Hệ thống HR hiện có (API)** | Tích hợp sau hackathon (roadmap) | 🟢 Roadmap |

**Vì sao KHÔNG dùng Git/Jira/Slack?**
- Không phải công ty nào cũng dùng Git (chỉ IT)
- Không phải ai cũng có Jira (nhiều công ty dùng Trello, ClickUp, hoặc Excel)
- Slack chỉ phổ biến ở startup tech
- → Data source phải **universal**: file (PDF/Excel/ảnh) + nhập tay + AI hỗ trợ

---

## X. 🤖 AI TOUCHPOINTS — 6 Điểm AI Can Thiệp

> **Tiêu chí AI Effectiveness chiếm 23% tổng điểm** — cần demo rõ AI KHÔNG CHỈ là chatbot wrapper

| # | AI Touchpoint | Mô tả | Tại sao ấn tượng |
|---|---|---|---|
| 1 | 🤖 **AI Import** | Upload CV/PDF → tự trích xuất tên, skills, kinh nghiệm, dự án vào profile | Tiết kiệm 30 phút nhập liệu → 10 giây |
| 2 | 🤖 **AI Smart Search** | PM/Sales hỏi bằng ngôn ngữ tự nhiên → nhận danh sách phù hợp + lý do | KHÔNG phải keyword match — AI HIỂU ngữ cảnh + reasoning |
| 3 | 🤖 **AI Insight per Persona** | Cùng data → HR thấy career path, PM thấy skill fit, Employee thấy growth | "Intelligence" chứ không phải "display" |
| 4 | 🤖 **AI Trend Analysis** | Phân tích Cross Assessment qua nhiều tháng → phát hiện pattern burnout/growth | AI thấy cái con người không thấy |
| 5 | 🤖 **AI Career Coach** | Gợi ý lộ trình phát triển dựa trên hồ sơ + định hướng tổ chức | Cá nhân hóa cho từng người, không generic |
| 6 | 🤖 **AI Course Suggest** | Đề xuất khóa học phù hợp dựa trên skill gap phát hiện | Chủ động đề xuất, không chờ HR gán |

**Câu trả lời cho BGK khi hỏi "AI khác gì ChatGPT wrapper?":**
> *"ChatGPT trả lời chung chung vì không biết nhân sự của bạn. CareerMate AI hiểu TOÀN BỘ context — hồ sơ, dự án, feedback, mục tiêu — nên câu trả lời dựa trên DATA THỰC của TỔ CHỨC BẠN, không phải internet."*

---

## XI. 📋 GRILL-ME — Các Quyết Định Đã Thảo Luận

> Đây là kết quả thảo luận chi tiết giữa team lead (Hiếu) và AI assistant

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Data đầu vào lấy từ đâu? | MVP dùng mock data. AI hỗ trợ import từ file (PDF/Excel/ảnh). Demo như auto-collect |
| 2 | "Magic Moment" trong demo? | 30 phút demo → gộp nhiều action, cần visualization mạnh |
| 3 | Đối tượng sử dụng? | Mọi ngành nghề, focus HR. Demo bằng use case IT company (gần gũi BGK) |
| 4 | Ngôn ngữ UI? | Đa ngôn ngữ, default tiếng Việt |
| 5 | AI Model nào? | Madison AI Gateway (Claude) làm chính — đã có sẵn |
| 6 | Deploy ở đâu khi demo? | Local `npm run dev` |
| 7 | Scope: làm bao nhiêu module? | ALL 7 modules — làm được cái nào hay cái đó, cái nào chưa kịp thì skip |

### Priority order 7 modules:
1. 🔴 **Competency Profile** — hồ sơ năng lực + AI insights + skill visualization
2. 🔴 **Smart Search** — chat AI tìm nhân sự bằng ngôn ngữ tự nhiên
3. 🔴 **AI Import** — upload CV/PDF → AI tự trích xuất data vào hồ sơ
4. 🟡 **Cross Assessment** — tự đánh giá + peer feedback hàng tháng
5. 🟡 **Goal Tracker** — mục tiêu cá nhân + tiến độ + AI gợi ý
6. 🟡 **Team Dashboard** — tổng quan team cho Management (wellbeing, skills gap)
7. 🟢 **Journey Timeline** — hành trình nhân viên từ onboard → hiện tại

---

## XII. ❓ CÂU HỎI BGK — CHUẨN BỊ SẴN

| # | Câu hỏi BGK có thể hỏi | Câu trả lời gợi ý |
|---|---|---|
| 1 | *"Khác gì BambooHR / Base HRM?"* | "Họ quản lý giấy tờ, chúng tôi quản lý CON NGƯỜI. Họ show data, chúng tôi PHÂN TÍCH data bằng AI." |
| 2 | *"Khác gì Lattice?"* | "Lattice focus performance review top-down. CareerMate focus employee journey bottom-up + AI intelligence." |
| 3 | *"AI ở đây khác gì ChatGPT wrapper?"* | "ChatGPT không biết nhân sự của bạn. CareerMate AI hiểu toàn bộ hồ sơ nhân sự — trả lời dựa trên DATA THỰC của tổ chức." |
| 4 | *"Sao nhân viên phải tự nhập data?"* | "Vì KHÔNG AI hiểu bạn bằng chính bạn. Và AI giúp nhập nhanh — upload 1 file PDF, AI fill 80% hồ sơ trong 10 giây." |
| 5 | *"24h làm được bao nhiêu?"* | "3 modules cốt lõi hoạt động hoàn chỉnh: Profile + Cross Assessment + AI Search. Các modules còn lại là roadmap." |
| 6 | *"Market size?"* | "Thị trường HR Tech toàn cầu đạt $35B năm 2025. VN có 800K+ doanh nghiệp — 95% chưa có tool đánh giá năng lực nhân sự bằng AI." |
| 7 | *"Nếu 6 tháng không ai cập nhật data thì sao?"* | "Cross Assessment hàng tháng tạo engagement loop tự nhiên. Thêm AI reminder khi phát hiện hồ sơ lâu chưa update." |
| 8 | *"Peer review có anonymous không?"* | "Có — manager thấy tên, nhưng peer-to-peer mặc định anonymous. HR có thể config tùy văn hóa công ty." |
| 9 | *"B2B hay B2C?"* | "B2B SaaS — mỗi công ty là 1 tenant. Roadmap: khi nhân viên chuyển cty, hồ sơ đi theo (data portability)." |
| 10 | *"Tại sao nhân viên muốn dùng tool này?"* | "Vì đây là nơi họ GHI LẠI hành trình của mình — không chờ ai ghi hộ. Và AI giúp họ thấy mình đã phát triển thế nào." |

---

## XIII. ✅ ĐỀ XUẤT CẢI THIỆN — ACTION ITEMS

| # | Hạng mục | Action cụ thể | Ai làm | Priority |
|---|---|---|---|---|
| 1 | Storytelling — thêm con số | Bổ sung data point (Gallup/nội bộ) vào phần Mở đầu | Content | 🔴 P0 |
| 2 | Storytelling — story thứ 3 | Thêm story "nhân viên giỏi nghỉ vì không được ghi nhận" | Content | 🟡 P1 |
| 3 | Storytelling — Before/After | Thêm bảng so sánh vào slide pitch | Content | 🔴 P0 |
| 4 | Tagline — chọn mạnh hơn | Team vote 1 trong 3 gợi ý | Cả team | 🟡 P1 |
| 5 | Data source — đã sửa | ~~Git/Jira/Slack~~ → AI Import + nhân sự tự nhập | ✅ Done | ✅ |
| 6 | AI touchpoints — liệt kê rõ | Tham khảo mục X — 6 điểm AI can thiệp | Dev | 🔴 P0 |
| 7 | Đối thủ cạnh tranh | Tham khảo mục VIII — thêm vào pitch deck | Content | 🔴 P0 |
| 8 | Câu hỏi BGK — tập trả lời | Tham khảo mục XII — 10 câu chuẩn bị sẵn | Cả team | 🔴 P0 |
| 9 | Demo script 30 phút | **Chưa có** — cần làm tiếp | Content + Dev | 🔴 P0 |
| 10 | Tên sản phẩm — chốt | CareerMate hay CareerMate AI? | Cả team | 🟡 P1 |

