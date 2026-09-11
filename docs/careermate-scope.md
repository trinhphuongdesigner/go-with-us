# CareerMate — Scope & Data Design

Tài liệu này hệ thống hóa ý tưởng trong
`docs/y-tuong-phan-mem-danh-gia-nang-luc-nhan-vien 1.docx` thành scope triển
khai cho codebase CareerMate, kèm 4 điểm làm rõ đã chốt. Đây là file để
**sửa trực tiếp khi scope thay đổi** — code bám theo file này.

---

## 1. Định vị sản phẩm

**CareerMate** — nền tảng đánh giá năng lực nhân sự toàn diện, đồng hành cùng
nhân sự từ ngày đầu gia nhập đến từng cột mốc phát triển.

| Vai trò | Nhu cầu chính |
|---|---|
| HR / Company Admin | Quản lý hồ sơ, thiết lập bộ tiêu chí đánh giá riêng của công ty, duyệt đánh giá, tổ chức đào tạo |
| Nhân sự (Employee) | Tự cập nhật hồ sơ, tự đánh giá hàng tháng, đặt mục tiêu, xem lộ trình phát triển |
| Sales / BOM / PM | Tra cứu nhân sự phù hợp cho dự án mới bằng ngôn ngữ tự nhiên |
| Công ty tuyển dụng mới | Xem "career passport" của ứng viên (đã được chủ hồ sơ chia sẻ) |

---

## 2. Bốn quyết định kiến trúc đã chốt

### 2.1 Import CV/LinkedIn = khởi tạo **hoặc** cập nhật hồ sơ
Upload/paste CV hoặc link LinkedIn → AI đọc và convert thành **dữ liệu có cấu
trúc** (skills, certifications, project experience, awards) → hiển thị dạng
**đề xuất** → người dùng chọn mục nào muốn ghi vào hồ sơ → apply.

Tuân thủ convention "AI là proposal, không tự persist" của dự án:
`POST /profile-imports/:id/parse` (proposal) → `POST /profile-imports/:id/apply`
(ghi thật). Không có object storage (theo `CLAUDE.md`) → chỉ lưu **text** đã
trích xuất trong Postgres, không lưu file gốc.

### 2.2 Cross Assessment do **từng công ty tự config**
Mỗi công ty dựng bộ thang đo riêng:

```
AssessmentTemplate (bộ tiêu chí của công ty)
└── AssessmentGroup (nhóm tiêu chí + trọng số)
    └── AssessmentQuestion (câu hỏi + mô tả expand + trọng số, thang điểm 1–10)
```

Luồng: nhân sự tự đánh giá (mood + điểm nổi bật + trả lời từng câu theo thang
10) → quản lý/đồng nghiệp đánh giá chéo → **người có quyền approve** →
`status = APPROVED`.

> **Bất biến sau khi approve:** mỗi `Assessment` được approve sẽ **snapshot**
> lại toàn bộ template (nhóm/trọng số/câu hỏi) vào `templateSnapshot`. Công ty
> sửa template ở kỳ sau **không** làm thay đổi kết quả đã duyệt trong quá khứ.
> Đây là điều kiện bắt buộc để "đánh giá theo nhân viên cả đời" có ý nghĩa.

### 2.3 Hồ sơ đánh giá **không mất khi nghỉ việc** (Career Passport)
Vấn đề với schema hiện tại: `User.companyId` gắn cứng một công ty, nghỉ việc là
mất ngữ cảnh.

Giải pháp — tách quan hệ "người" khỏi "kỳ làm việc":

- `User` = **tài khoản cả đời của con người**, không bị xóa khi rời công ty.
- `Employment` = **một kỳ làm việc** tại một công ty (vị trí, level, từ ngày –
  đến ngày, ACTIVE/ENDED). Một người có nhiều `Employment`.
- `User.companyId` giữ lại làm con trỏ "công ty hiện tại" (để không phá vỡ
  role-scoping của các module đang chạy); nghỉ việc → `companyId = null` +
  `Employment.status = ENDED`.
- Mọi bản ghi đánh giá/dự án/summary trỏ về `employmentId` → dữ liệu vẫn còn
  nguyên ngữ cảnh "làm ở công ty nào, giai đoạn nào, vị trí gì" kể cả khi đã
  rời đi.
- `CareerSummary` = bản tóm tắt do AI sinh cho **một kỳ làm việc** (thái độ,
  năng lực ở vị trí, điểm mạnh, quá trình phát triển), tổng hợp từ assessments
  đã approve + skills + projects + goals trong giai đoạn đó.
- `CareerPassportShare` = chủ hồ sơ tạo link chia sẻ (token, có hạn, thu hồi
  được) để công ty mới xem read-only quá trình phát triển và đánh giá độ phù
  hợp.

**Nguyên tắc quyền riêng tư:** công ty cũ chỉ thấy dữ liệu thuộc kỳ làm việc
tại công ty mình; công ty mới chỉ thấy những gì chủ hồ sơ chủ động share.

### 2.4 Ưu tiên triển khai
Schema đầy đủ → một số API backend cơ bản → **trọng tâm là frontend** của các
tính năng dưới đây.

---

## 3. Module & trạng thái

| # | Module | Trạng thái | Ghi chú |
|---|---|---|---|
| M1 | Hồ sơ năng lực toàn diện (timeline, certifications, project experience, awards) | 🟡 Mở rộng | Đã có `EmployeeSkill`; bổ sung `Certification`, `ProjectExperience`, `Award` |
| M2 | Import CV / LinkedIn (AI parse → proposal → apply) | 🔴 Mới | `ProfileImport` |
| M3 | Cross Assessment + bộ tiêu chí công ty tự config | 🔴 Mới | `AssessmentTemplate/Group/Question/Cycle/Assessment/Answer` |
| M4 | Career Passport (kỳ làm việc + AI summary + share link) | 🔴 Mới | `Employment`, `CareerSummary`, `CareerPassportShare` |
| M5 | Trợ lý hỏi-đáp (NLQ tìm nhân sự + đồng hành cá nhân) | 🟡 Nâng cấp | Đã có match theo requirement có cấu trúc; thêm chat tự do |
| M6 | Lộ trình phát triển (cột mốc + nhiệm vụ đo lường được) | 🟡 Mở rộng | Đã có `DevelopmentPlan/Goal`; thêm `DevelopmentMilestone/Task` |
| M7 | Goal Tracker 2 nhóm (công việc / cá nhân) | 🟡 Mở rộng | Thêm `category`, `dueDate` vào `DevelopmentGoal` |

**Ngoài scope hiện tại** (định hướng sau cuộc thi): lịch sử đào tạo & đăng ký
khóa học/điểm danh, đề xuất khóa học bằng AI, bài test đánh giá năng lực theo
level, tích hợp hệ thống HR ngoài.

---

## 4. Data model mới (tóm tắt)

Chi tiết đầy đủ ở `backend/prisma/schema.prisma`.

```
User (tài khoản cả đời)
├── Employment[] ────────────── Company        # kỳ làm việc
│   ├── Assessment[]                           # đánh giá trong kỳ đó
│   ├── ProjectExperience[]
│   └── CareerSummary                          # AI tóm tắt kỳ làm việc
├── EmployeeSkill[] / Certification[] / Award[]
├── ProfileImport[]                            # CV/LinkedIn đã parse
├── DevelopmentPlan → DevelopmentMilestone[] → DevelopmentTask[]
├── DevelopmentGoal[]  (category: WORK | PERSONAL)
├── CareerPassportShare[]                      # link chia sẻ hồ sơ
└── AssistantConversation[] → AssistantMessage[]

Company
├── AssessmentTemplate[] → AssessmentGroup[] → AssessmentQuestion[]
└── AssessmentCycle[]                          # kỳ đánh giá (theo tháng)
```

---

## 5. API surface dự kiến

| Nhóm | Endpoint |
|---|---|
| Profile import | `POST /profile-imports` · `POST /profile-imports/:id/parse` (AI proposal) · `POST /profile-imports/:id/apply` |
| Competency profile | `GET/POST/PATCH/DELETE /certifications` · `/project-experiences` · `/awards` · `GET /competency-profile/:userId` (tổng hợp timeline) |
| Assessment config | `GET/POST/PATCH/DELETE /assessment-templates` (+ groups/questions lồng nhau) |
| Assessment flow | `GET/POST /assessment-cycles` · `POST /assessments` · `PATCH /assessments/:id` · `POST /assessments/:id/submit` · `POST /assessments/:id/approve` |
| Career passport | `GET/POST/PATCH /employments` · `POST /career-summaries/generate` (AI proposal) · `POST /career-summaries` (save) · `POST /passport-shares` · `GET /passport/:token` (public) |
| Assistant | `POST /assistant/query` (NLQ tìm nhân sự / đồng hành cá nhân) |
| Roadmap | `GET/POST/PATCH/DELETE /development-plans/me/milestones` (+ tasks) |

---

## 6. Frontend — màn hình dự kiến

| Route | Vai trò | Nội dung |
|---|---|---|
| `/profile` | Employee | Hồ sơ năng lực dạng timeline + tabs (thông tin, kỹ năng, bằng cấp, dự án, thành tích) |
| `/profile/import` | Employee | Upload/paste CV hoặc link LinkedIn → xem đề xuất AI → chọn mục để apply |
| `/assessments` | Employee | Danh sách kỳ đánh giá, form tự đánh giá (mood + điểm nổi bật + câu hỏi thang 10) |
| `/assessments/[id]` | Employee/Admin | Chi tiết một bài đánh giá, luồng submit/approve |
| `/settings/assessment-templates` | Company Admin | Builder bộ tiêu chí: nhóm + trọng số + câu hỏi + mô tả expand |
| `/employees/[id]/passport` | Admin | Career passport của nhân sự: các kỳ làm việc, AI summary, điểm theo thời gian |
| `/career-passport` | Employee | Passport của chính mình + quản lý link chia sẻ |
| `/passport/[token]` | Public | View read-only cho công ty mới (ngoài AppShell) |
| `/assistant` | Tất cả | Chat hỏi-đáp tìm nhân sự / đồng hành cá nhân |
| `/development-plan` | Employee | Bổ sung cột mốc + nhiệm vụ đo lường được vào trang đang có |

---

## 7. Vòng phản hồi 2 — mở rộng scope (đã ghi nhận, CHƯA code)

Ba điểm dưới đây là phản hồi mới sau khi review vòng 1. Ghi lại thiết kế đề
xuất ở đây để không mất ngữ cảnh, nhưng **chưa triển khai** — theo yêu cầu,
sẽ chờ anh/chị xem UI hiện tại rồi bổ sung context cụ thể cho từng mục trước
khi code tiếp.

### 7.1 Phân quyền Admin linh hoạt

Hiện tại `COMPANY_ADMIN` là một khối quyền đơn (`@Roles(COMPANY_ADMIN)` cho
mọi route quản trị). Yêu cầu mới: một công ty có thể có nhiều người ở phía
"admin" với quyền hạn khác nhau — full quyền / chỉ xem / thu thập thông tin
(nhập liệu, không duyệt) / đánh giá chéo (peer/manager assessment) / duyệt
đánh giá (approve) / sửa đánh giá.

**Đề xuất:** thêm `enum AdminPermission { VIEW, COLLECT, CROSS_ASSESS,
APPROVE, EDIT, FULL }` và `User.adminPermissions AdminPermission[]` (chỉ có
ý nghĩa khi `role = COMPANY_ADMIN`). Guard ở từng route đổi từ
`@Roles(COMPANY_ADMIN)` sang check permission cụ thể (`FULL` luôn pass, coi
như superset). Cần anh/chị xác nhận: danh sách quyền trên đã đủ chưa, và
liệu Super Admin có cấp/thu hồi quyền này cho từng Company Admin, hay
Company Admin tự cấp cho nhau trong công ty mình.

### 7.2 Hồ sơ tổng hợp khách quan khi offboarding (tổ chức đánh giá, không phải self-report)

Làm rõ vòng quan hệ:

```
User tự cập nhật hồ sơ (chứng chỉ, kiến thức, skill)
  → Công ty ghi nhận, đánh giá chéo, assign vào dự án phù hợp
  → Nhân sự thể hiện qua dự án, được đánh giá lại
  → Khi rời công ty: kết quả đánh giá của TOÀN TỔ CHỨC (PM, HR, đồng
    nghiệp) được AI tổng hợp thành 1 kết quả có hệ thống, ghi vào hồ sơ
    cá nhân như một lần "update CV" — nhưng đây KHÔNG phải dữ liệu do
    User tự nhập, mà là phán quyết khách quan của tổ chức cũ.
```

Điều này khác `CareerSummary` đã có ở mục 2.3: hiện `generateSummary` cho
phép cả chủ hồ sơ tự bấm generate, và output chỉ là markdown tự do. Cần bổ
sung:

- **Nguồn dữ liệu bắt buộc là dữ liệu tổ chức** (`Assessment` đã approve,
  `ActivityLog`/mức tham gia hoạt động do người khác ghi nhận...) — không
  được lấy `Certification`/`Award` tự khai làm căn cứ chính.
- **Chỉ phía Admin (có quyền `APPROVE` hoặc `FULL` ở mục 7.1) mới được
  trigger** bản tổng hợp offboarding — nhân viên không tự tạo bản này cho
  chính mình, đúng tinh thần "khách quan hơn vì do tổ chức đánh giá".
- **Kết quả có cấu trúc theo trục điểm** thay vì chỉ markdown tự do — ví
  dụ: chuyên cần, năng động, kiến thức, kỹ năng, mức độ tham gia hoạt
  động. Vì mỗi công ty có `AssessmentTemplate` riêng (mục 2.2), cần một
  tầng "chuẩn hóa" để hồ sơ từ nhiều công ty khác nhau so sánh được —
  đề xuất `enum EvaluationDimension { ATTENDANCE, PROACTIVENESS,
  KNOWLEDGE, SKILL, ACTIVITY_PARTICIPATION }` cố định, và AI map từ các
  `AssessmentGroup`/câu hỏi cụ thể của công ty đó sang các trục cố định
  này khi tổng hợp. Lưu vào `CareerSummary.dimensionScores Json` (hoặc
  bảng con riêng nếu cần kèm rationale từng trục).
- **Đánh dấu nguồn gốc rõ ràng**: `CareerSummary.source: SELF_REQUESTED |
  ORGANIZATION_OFFBOARDING` để phân biệt bản do chính chủ tự tạo (hiện
  có) với bản tổ chức xác nhận lúc offboarding (đáng tin hơn, nên hiển
  thị nổi bật hơn trên passport).

Cần anh/chị xác nhận thêm: 5 trục ví dụ trên đã đủ chưa hay cần tùy công ty
định nghĩa thêm trục riêng; và việc tạo bản offboarding này có nên tự động
kích hoạt khi Admin bấm "kết thúc kỳ làm việc" hay luôn là hành động thủ
công riêng.

### 7.3 Lộ trình phát triển dạng sơ đồ trực quan, sửa trực tiếp trên UI

Hiện tại (mục M6) roadmap AI-suggest chỉ là markdown text
(`DevelopmentPlan.content`) dù schema đã có sẵn `DevelopmentMilestone` →
`DevelopmentTask` cho phần "đo lường được". Yêu cầu mới: AI generate ra một
**sơ đồ trực quan** (không phải text thuần) — milestone dạng node/thẻ trên
một dạng roadmap/timeline, có thể **sửa trực tiếp trên UI** (thêm/xóa/sửa
tên, mô tả, ngày, kéo-thả thứ tự) trước khi lưu. Khi người dùng đồng ý và
bấm Save, mới convert cây đã sửa thành record thật: mỗi milestone → 1
`DevelopmentMilestone`, mỗi mục tiêu trong milestone → 1 `DevelopmentTask`
thuộc milestone đó.

**Đề xuất kỹ thuật:** không dùng `HtmlPreview` (iframe `sandbox=""`, không
tương tác được) như đang dùng cho Development Plan — cần một React
component riêng render milestone dạng thẻ/node theo chiều ngang hoặc dạng
cây, với input inline cho từng field, thêm/xóa milestone và task ngay trên
UI. AI chỉ trả về JSON đề xuất `{ milestones: [{ title, description,
dueDate, tasks: [{ title, metric }] }] }` (đúng convention proposal, không
tự lưu); component giữ cây này ở local state cho đến khi bấm Save.

Cần anh/chị cho thêm ví dụ/tham khảo hình ảnh về "dạng sơ đồ vui vẻ, dễ
nhìn" mong muốn (timeline ngang kiểu roadmap sản phẩm? cây phân nhánh kiểu
mindmap? dạng board Kanban theo mốc thời gian?) để chọn đúng layout trước
khi build.
