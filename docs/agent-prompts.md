# CareerMate — Agent Delegation Prompts

> **Mục đích:** Prompt sẵn để giao việc cho các AI agents (PI Desktop, ChatGPT/Codex, Antigravity IDE)
> **Dự án:** go-with-us (CareerMate)
> **Repo:** https://github.com/trinhphuongdesigner/go-with-us
> **Ngày:** 11/09/2026

---

## 🏗️ CONTEXT CHUNG (Copy vào đầu mỗi prompt)

```
Bạn đang làm việc trên dự án CareerMate — nền tảng đánh giá năng lực nhân sự toàn diện.

**Tech Stack:**
- Backend: NestJS 11 + Prisma 6.19 + PostgreSQL (port 3000, prefix /api)
- Frontend: Next.js 16 + React 19 + MUI v9 + TypeScript (port 3001)
- AI: Multi-adapter (Claude/GPT/Gemini) qua AiChatService

**Quy tắc BẮT BUỘC:**
1. Đọc CLAUDE.md ở root trước khi code — chứa toàn bộ convention
2. Mọi trang UI phải dùng AppShell + PageContainer + PageHeader + Card
3. AI feature phải đi qua AiChatService, tuân thủ "Proposal, never self-persists"
4. Không thêm Object Storage (S3/Spaces) — lưu text vào PostgreSQL
5. Giữ Prisma ở 6.19.3, không upgrade
6. Style theo docs/style-concept.md (token màu, Google Sans, bo góc 8px/14px/22px)
7. Tài khoản demo: superadmin@gowithus.dev / Password123!

**Cấu trúc project:**
- backend/src/modules/ — mỗi feature 1 module (controller + service + dto)
- frontend/src/app/ — App Router pages
- frontend/src/components/ — layout/ (AppShell, PageContainer) + ui/ (Card, StatusChip)
- frontend/src/lib/api/ — API client functions
- frontend/src/types/ — shared TypeScript types
```

---

## 📋 PROMPT 1: Dashboard Page (FE) — Cho PI Desktop hoặc ChatGPT

```
## Task: Xây dựng trang Dashboard (/) cho CareerMate

[Dán CONTEXT CHUNG ở trên vào đây]

### Yêu cầu:
File cần sửa: `frontend/src/app/page.tsx` (hiện đang là "Coming soon")

Xây dựng Dashboard hiển thị khác nhau theo role:

**Super Admin Dashboard:**
- Card tổng số companies
- Card tổng số users
- Danh sách companies mới nhất

**Company Admin Dashboard:**
- Card tổng nhân viên công ty
- Card trung bình skill level
- Card số peer reviews tháng này
- Danh sách nhân viên mới nhất (top 5)
- Quick actions: Tạo Job Requirement, Xem Skills

**Employee Dashboard:**
- Card "Chào [tên], đây là tổng quan của bạn"
- Card số skills đã khai báo
- Card số activity logs tháng này
- Card tiến độ development plan
- Peer reviews gần nhất nhận được
- Quick actions: Cập nhật Skills, Viết Activity Log

### Hướng dẫn kỹ thuật:
- Dùng AuthContext để lấy user.role
- Gọi các API đã có sẵn trong frontend/src/lib/api/
- Layout: Grid MUI, responsive (xs=12, md=6, lg=4)
- Dùng component Card từ src/components/ui/Card.tsx
- Loading state: dùng Skeleton MUI
- Không tạo component mới nếu không cần — dùng lại Card, StatusChip

### Test:
- Login superadmin@gowithus.dev → thấy dashboard Super Admin
- Login admin@acme.dev → thấy dashboard Company Admin  
- Login alice@acme.dev → thấy dashboard Employee
```

---

## 📋 PROMPT 2: Profile Page (FE) — Cho PI Desktop hoặc ChatGPT

```
## Task: Xây dựng trang Profile (/profile) cho CareerMate

[Dán CONTEXT CHUNG ở trên vào đây]

### Yêu cầu:
File cần sửa: `frontend/src/app/profile/page.tsx` (hiện đang là "Coming soon")

Xây dựng trang Profile cá nhân cho Employee:

**Sections:**
1. **Header Profile:** Avatar (chữ cái đầu), tên, email, role, company, ngày tham gia
2. **Skills Overview:** Radar chart hoặc horizontal bar chart hiển thị skills đã khai báo (level 1-5)
3. **Activity Summary:** Tổng số activity logs theo loại (Hobby, Volunteer, Certification...) — dùng StatusChip
4. **Recent Peer Reviews:** 3 reviews gần nhất nhận được — hiển thị rating + comment
5. **Development Plan Status:** Tổng số goals, completed vs in-progress, link tới /development-plan

### Hướng dẫn kỹ thuật:
- Gọi API: GET /api/users/me, GET /api/skills-competency/insight/:userId
- Dùng MUI Grid, Card, Chip, LinearProgress
- Không cần chart library — dùng MUI LinearProgress cho skill bars
- Mỗi skill bar: tên skill | ████████░░ | 4/5
- Responsive: desktop 2 columns, mobile 1 column

### Test:
- Login alice@acme.dev → thấy profile đầy đủ với skills, activities, reviews
```

---

## 📋 PROMPT 3: AI Import CV (FE + BE) — Cho Antigravity IDE

```
## Task: Xây dựng tính năng AI Import CV cho CareerMate

[Dán CONTEXT CHUNG ở trên vào đây]

### Mô tả:
User upload file CV (PDF/DOCX) → AI trích xuất thông tin → tự động fill vào hồ sơ năng lực.
Đây là WOW feature cho demo hackathon.

### Backend (NestJS):
1. Tạo module mới: `backend/src/modules/cv-import/`
   - `cv-import.controller.ts`: POST /api/cv-import/extract
   - `cv-import.service.ts`: Nhận file text content, gọi AiChatService
   - `cv-import.module.ts`: Import AiChatModule, PrismaModule
   - `dto/extract-cv.dto.ts`: { content: string }

2. Logic:
   - Nhận text content của CV (frontend đọc file → gửi text, KHÔNG upload file binary)
   - Gọi AiChatService với prompt:
     ```
     Trích xuất thông tin từ CV sau và trả về JSON:
     {
       "name": "...",
       "email": "...",
       "skills": [{"name": "React", "level": 4}, ...],
       "projects": [{"name": "...", "role": "...", "techStack": ["..."], "duration": "..."}],
       "certifications": [{"name": "...", "issuer": "...", "year": 2024}],
       "education": [{"school": "...", "degree": "...", "year": 2020}]
     }
     CV content: {cvText}
     ```
   - Parse JSON response (dùng defensive parsing giống development-plans)
   - Trả về structured data cho frontend (KHÔNG tự lưu DB — "Proposal" pattern)

### Frontend (Next.js):
1. Tạo page: `frontend/src/app/cv-import/page.tsx`
2. UI Flow:
   - Drag & drop zone hoặc button "Chọn file"
   - Đọc file bằng FileReader API → extract text
   - Gọi API → Loading state với progress message
   - Hiển thị kết quả trích xuất trong Card layout:
     - Thông tin cá nhân
     - Bảng skills (editable — user có thể sửa level)
     - Bảng projects
     - Bảng certifications
   - Button "Lưu vào hồ sơ" → gọi bulk upsert skills API đã có
3. Thêm menu item vào AppShell sidebar

### Lưu ý:
- KHÔNG dùng multer / file upload — chỉ đọc text từ client side
- Giữ convention: AppShell + PageContainer + PageHeader + Card
- PDF reading: có thể dùng simple text extraction, không cần pdf.js cho MVP
```

---

## 📋 PROMPT 4: Cross Assessment (FE + BE) — Cho ChatGPT/Codex

```
## Task: Xây dựng tính năng Cross Assessment hàng tháng cho CareerMate

[Dán CONTEXT CHUNG ở trên vào đây]

### Mô tả:
Nhân viên tự đánh giá tâm trạng + điểm nổi bật hàng tháng.
Manager bổ sung feedback. AI tổng hợp trend qua nhiều tháng.

### Backend:
1. Thêm vào Prisma schema (`backend/prisma/schema.prisma`):
   ```prisma
   model CrossAssessment {
     id          String   @id @default(uuid())
     userId      String
     user        User     @relation(fields: [userId], references: [id])
     companyId   String
     company     Company  @relation(fields: [companyId], references: [id])
     month       Int      // 1-12
     year        Int      // 2026
     mood        String   // emoji: 😊, 😐, 😟, 😢, 🔥
     highlight   String   // 1 câu điểm nổi bật
     managerNote String?  // feedback từ manager
     managerId   String?  // ai viết note
     rating      Int?     // 1-5 sao (manager đánh giá)
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt
     
     @@unique([userId, month, year])
   }
   ```

2. Tạo module: `backend/src/modules/cross-assessment/`
   - CRUD endpoints
   - GET /api/cross-assessment/me — lấy assessments của mình
   - GET /api/cross-assessment/team — Company Admin xem team
   - POST /api/cross-assessment — employee tạo/update
   - PATCH /api/cross-assessment/:id/manager-note — manager thêm note
   - GET /api/cross-assessment/trend/:userId — AI phân tích trend

3. AI Trend Analysis:
   - Lấy 6 tháng gần nhất
   - Gọi AiChatService: "Phân tích trend tâm trạng và hiệu suất dựa trên data..."
   - Trả về insight dạng markdown

### Frontend:
1. Page: `frontend/src/app/cross-assessment/page.tsx`
2. Employee view:
   - Form đơn giản: Chọn emoji tâm trạng (5 emoji buttons) + viết highlight
   - Lịch sử assessments (timeline vertical, emoji + highlight + manager note)
3. Manager view:
   - Danh sách team members + tháng này đã submit chưa
   - Click vào → xem detail + thêm manager note + rating
   - Button "AI Trend Analysis" → xem insight
4. Thêm vào AppShell sidebar menu

### Test:
- alice@acme.dev submit assessment tháng 9/2026
- admin@acme.dev xem team → thêm note cho Alice
- admin@acme.dev bấm AI Trend → xem phân tích
```

---

## 📋 PROMPT 5: Floating AI Assistant (FE) — Cho bất kỳ agent nào

```
## Task: Xây dựng Floating AI Chat Assistant cho CareerMate

[Dán CONTEXT CHUNG ở trên vào đây]

### Mô tả:
Nút chat tròn ở góc phải dưới → mở panel chat AI.
2 mode:
- PM/Sales/BOM: "Tìm nhân sự phù hợp cho dự án X"
- Employee: "Gợi ý lộ trình phát triển cho tôi"

### Frontend:
1. Component: `frontend/src/components/ui/FloatingAiChat.tsx`
2. UI:
   - FAB button (MUI Fab) góc phải dưới, icon chat
   - Click → mở panel 400x500px (hoặc full width trên mobile)
   - Chat interface: messages list + input + send button
   - Typing indicator khi AI đang trả lời
3. Logic:
   - Gọi endpoint: POST /api/ai-chat (đã có sẵn trong backend!)
   - Body: { message: "...", context: "employee_search" | "career_coach" }
   - Stream response hoặc wait full response
4. Mount trong AppShell.tsx (hiển thị trên mọi trang sau login)
5. System prompt tự động thêm context user (role, company, skills)

### Backend:
- Endpoint /api/ai-chat ĐÃ CÓ SẴN — chỉ cần bổ sung system prompt context
- Sửa AiChatService: nhận thêm param `context` để switch system prompt:
  - "employee_search": prompt tìm nhân sự
  - "career_coach": prompt đồng hành phát triển

### Lưu ý:
- Không cần lưu chat history vào DB cho MVP
- Markdown rendering cho AI response (dùng marked + HtmlPreview đã có)
```

---

## 🎯 PHÂN CÔNG GỢI Ý

| Agent | Task | Priority | Thời gian ước |
|---|---|---|---|
| **PI Desktop** | Prompt 1: Dashboard Page | 🔴 P0 | 1-2h |
| **ChatGPT/Codex** | Prompt 2: Profile Page | 🔴 P0 | 1-2h |
| **Antigravity IDE** | Prompt 3: AI Import CV | 🔴 P0 | 2-3h |
| **PI Desktop** | Prompt 4: Cross Assessment (BE) | 🟡 P1 | 2-3h |
| **ChatGPT/Codex** | Prompt 4: Cross Assessment (FE) | 🟡 P1 | 2-3h |
| **Bất kỳ** | Prompt 5: Floating AI Chat | 🟡 P1 | 1-2h |

> **Lưu ý:** Mỗi agent làm trên branch riêng, merge vào master qua PR.
> Branch naming: `feature/dashboard`, `feature/profile`, `feature/cv-import`, `feature/cross-assessment`, `feature/ai-chat-floating`
