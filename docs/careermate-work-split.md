# CareerMate — Real vs Mock & chia việc cho 2 dev

Chỉ liệt kê để chia việc — **không đổi code** trong lần này. Bản này thay
thế bản trước, đã sửa theo các đính chính mới nhất.

## 0. Đính chính so với bản trước

1. **"Đánh giá chéo" = "Cross Assessment"** — cùng một khái niệm, không
   phải 2 thứ khác nhau. Module `assessments/` (tính năng #3) là bản thật
   duy nhất cho khái niệm này. → Module **Peer Reviews cũ** (riêng biệt,
   `backend/src/modules/peer-reviews/`, `/peer-reviews`, model
   `PeerReview` tự do không theo thang điểm công ty) coi như **đã bị thay
   thế hoàn toàn** — khuyến nghị không đầu tư thêm, có thể ẩn khỏi nav sau
   này (không làm trong lần chia việc này, chỉ note lại).
2. **Phân quyền Admin là REAL, không phải mock** — nhưng không cần dựng
   UI cấu hình quyền động; thay vào đó **seed sẵn vài bộ quyền cơ bản**
   (giống cách `Role` hiện tại là cơ chế phân quyền thật duy nhất) rồi
   backend enforce thật theo permission, không chỉ theo `Role`.
3. **Offboarding summary đổi luồng**: nhân sự chỉ **request**, **Admin mới
   là người approve + trigger** việc tạo bản tổng hợp. Khi AI viết summary,
   phần thông tin nhạy cảm (tên dự án, tên khách hàng...) phải được
   đổi/ẩn đi. Admin xem bản nháp và **chỉ được sửa phần thông tin
   nhạy cảm** (dự án, khách hàng); **không được sửa phần đánh giá** (thái
   độ, năng lực...) vì đó không phải thông tin nhạy cảm và phải giữ tính
   khách quan.
4. **AI Assistant chạy thật** (không phải "để nguyên, ngoài phạm vi" như
   bản trước) — và mở rộng thêm: mỗi màn hình có 1 assistant **focus theo
   chủ đề màn hình đó**, tự động thu thập context liên quan (vd. màn tạo
   lộ trình thì tự lấy hồ sơ/skill của user làm context), và phải **hỏi
   lại** nếu context chưa đủ rõ thay vì đoán bừa.
5. **Thêm nhỏ**: trang login cần dropdown chọn nhanh giữa các tài khoản
   demo đã seed sẵn (nhiều role khác nhau), và dữ liệu seed phải
   **consistent** — vd. nhân sự A thuộc company X thì khi đăng nhập bằng
   admin của company X phải thấy đúng thông tin A.

---

## 1. Hạ tầng dùng chung (real, bắt buộc — không thuộc phần chia việc chính)

- `backend/src/modules/auth/`, `users/`, `companies/` — đăng nhập, vai trò
  cơ bản, scope theo company.
- `backend/src/modules/ai-settings/`, `ai-chat/` — kết nối provider AI,
  `AiChatService` dùng chung cho mọi tính năng AI.
- `backend/src/modules/skills-competency/` — catalog `Skill` +
  `EmployeeSkill`.
- `backend/src/modules/activity-logs/` — input phụ cho timeline hồ sơ cá
  nhân.
- **Login dropdown demo accounts + seed consistency** (mục 0.5) — việc nhỏ,
  nên làm sớm, ai rảnh trước làm, cả 2 dev đều cần nó để test phần của
  mình (đổi role nhanh mà không phải gõ lại email/password).
- File cần đụng chung, dễ conflict nhất: `backend/prisma/schema.prisma`,
  `backend/src/app.module.ts`, `frontend/src/components/layout/AppShell.tsx`
  (nav), `backend/prisma/seed.ts`.

---

## 2. Tính năng REAL #1 — Hồ sơ & lộ trình cá nhân

**Phạm vi:** import tài liệu cập nhật hồ sơ → tạo/sửa lộ trình phát triển
(nhiều lộ trình song song, mỗi lần lưu tạo một lộ trình mới thay vì ghi đè;
hỗ trợ bởi AI assistant focus theo chủ đề) → theo dõi & cập nhật tiến độ →
kết quả được duyệt cộng điểm (dùng chung
pipeline với tính năng #3) → khi rời tổ chức, nhân sự **request**, Admin
**approve + trigger** tổng hợp hồ sơ (có redact thông tin nhạy cảm) làm
đầu vào apply việc khác.

**Module/route liên quan:**
- `backend/src/modules/competency-profile/` — Certification/Project/Award
  CRUD + timeline. Frontend: `/profile`.
- `backend/src/modules/profile-imports/` — AI parse CV/LinkedIn → proposal
  → apply có chọn lọc. Frontend: `/profile/import`.
- `backend/src/modules/development-plans/` — roadmap AI + `DevelopmentGoal`.
  Frontend: `/development-plan`.
- `backend/src/modules/career-passport/` — kỳ làm việc, AI career summary,
  share link, trang public. Frontend: `/career-passport`,
  `/employees/[id]/passport`, `/passport/[token]`.
- `backend/src/modules/assistant/` (mở rộng, xem mục 4) — assistant focus
  chủ đề "roadmap" dùng ngay trong luồng tạo lộ trình.

**Đã có (real):**
- Import CV → AI đề xuất có cấu trúc → tick chọn → apply vào hồ sơ.
- CRUD certifications/projects/awards + timeline gộp.
- `DevelopmentGoal` có `progress`, `dueDate` trong schema — không còn phân
  nhóm công việc/cá nhân (`category` đã bỏ khỏi `DevelopmentGoal`, `Award`
  và `DevelopmentRoadmap`).
- `development-plans` expose đầy đủ CRUD cho `DevelopmentMilestone`/
  `DevelopmentTask`, và roadmap dùng **assistant hội thoại nhiều lượt,
  focus chủ đề "roadmap"** — tự lấy hồ sơ/skill/goal của user làm context
  ngay từ đầu, AI hỏi lại nếu thiếu thông tin, chốt đề xuất milestone/task
  khi đủ rõ. Có component UI sửa trực tiếp được (thêm/xóa/sửa milestone &
  task, sắp xếp lại thứ tự) trước khi bấm Save mới ghi thật.
- Mỗi lần lưu roadmap tạo một `DevelopmentRoadmap` mới (không ghi đè lộ
  trình cũ) — trang `/development-plan` hiển thị mọi lộ trình đã lưu thành
  các section độc lập, có thể thu gọn/mở rộng từng cái.
- Career Passport: employment CRUD, share link thu hồi được, trang public
  đọc qua token.

**Cần code thêm (gap):** không còn gap đáng kể ở phần roadmap/goal — xem
mục 0 (Not yet built) trong `CLAUDE.md` cho các phần khác của dự án chưa
làm.
- **Luồng offboarding summary đổi hẳn theo mục 0.3** — đây là phần việc
  nặng nhất của tính năng #1:
  - Nhân sự: nút "Request tổng hợp hồ sơ" trên 1 kỳ làm việc đã/sắp kết
    thúc → chỉ tạo yêu cầu, **không tự sinh AI**.
  - Admin: có hàng đợi các request đang chờ, bấm **trigger** mới thật sự
    gọi AI.
  - AI phải trả về **2 phần tách biệt**: phần tường thuật (dự án, khách
    hàng...) đã được anonymize/redact tên cụ thể, và phần đánh giá (thái
    độ, năng lực, `dimensionScores` theo trục cố định — xem
    `docs/careermate-scope.md` mục 7.2) sinh từ dữ liệu Assessment đã
    duyệt.
  - Admin chỉ sửa được phần tường thuật/thông tin nhạy cảm; **API phải
    chặn** việc sửa phần đánh giá/điểm — cần thêm field tách biệt trên
    `CareerSummary` (vd. `narrative` editable vs `evaluation` +
    `dimensionScores` khóa) và trạng thái duyệt (`status` trên
    `CareerSummary` hiện chưa có, cần thêm).
  - Cần permission `APPROVE` (xem mục 4) để gate hành động trigger/approve
    của Admin.

---

## 3. Tính năng REAL #2 — Tổ chức quản lý & tìm nhân sự phù hợp dự án

**Phạm vi:** quản lý/đánh giá năng lực nhân viên, xem/collect thông tin
nhân sự bất kỳ lúc nào, tìm nhân sự phù hợp yêu cầu dự án.

**Module/route liên quan:**
- `backend/src/modules/users/`, `skills-competency/` (insight endpoint).
  Frontend: `/employees`, `/employees/[id]`.
- `backend/src/modules/competency-profile/`, `career-passport/` — Admin
  xem hồ sơ/passport của nhân viên cùng công ty.
- `backend/src/modules/job-requirements/` — CRUD yêu cầu dự án + AI
  matching. Frontend: `/job-requirements`.

**Đã có (real) — về cơ bản đầy đủ:**
- Roster nhân viên + trang insight tổng hợp.
- Admin xem hồ sơ năng lực & career passport bất kỳ nhân viên nào trong
  công ty, bất kỳ lúc nào.
- Job Requirements CRUD + AI match ứng viên theo skill/kinh nghiệm.

**Cần code thêm (gap):**
- Gate hành động "xem"/"collect thông tin" theo permission `VIEW`/`COLLECT`
  (xem mục 4) thay vì chỉ theo `Role` như hiện tại.
- Ngoài ra không có lỗ hổng kiến trúc lớn — phần việc nhẹ hơn 2 tính năng
  còn lại.

---

## 4. Tính năng REAL #3 — Cross Assessment (= "đánh giá chéo")

**Phạm vi:** công ty tạo tiêu chí/trọng số/nhóm tiêu chí/tần suất → cá
nhân được **phân công** đánh giá chéo → Admin có quyền review/duyệt kết
quả cuối → kết quả cập nhật **trực tiếp** vào hồ sơ năng lực cá nhân.

**Module/route liên quan:**
- `backend/src/modules/assessments/` — template/group/question, cycle,
  assessment CRUD + submit/approve/reject. Frontend: `/assessments`,
  `/assessments/[id]`, `/settings/assessment-templates`.

**Đã có (real):**
- Builder tiêu chí: nhóm + trọng số + câu hỏi + trọng số câu hỏi + hướng
  dẫn chấm + thang điểm tùy chỉnh.
- Cycle theo tháng, mở/đóng thủ công.
- Luồng draft → submit (tự tính điểm có trọng số) → approve/reject.
- Approve đóng băng bản sao tiêu chí (`templateSnapshot`).

**Cần code thêm (gap) — nặng nhất trong 3 tính năng:**
1. **Tần suất theo mục tiêu tổ chức**: thêm tần suất trên
   `AssessmentTemplate` (monthly/quarterly/...) + cơ chế tạo cycle kế tiếp
   tự động/gợi ý theo tần suất.
2. **Phân công đánh giá chéo**: hiện nhân viên tự chọn đồng nghiệp để đánh
   giá. Cần model gán cặp reviewer↔reviewee do Admin/hệ thống chỉ định mỗi
   cycle, màn hình Admin để phân công, và đổi `/assessments` phía nhân
   viên từ "chọn tự do" sang "danh sách được giao".
3. **Ghi điểm trực tiếp vào hồ sơ năng lực**: khi approve, cần tính và cập
   nhật điểm tổng hợp lên field hiển thị trên hồ sơ (`User.contributionScore`
   / `attitudeScore` có sẵn trong schema nhưng chưa có chỗ nào ghi) — đây
   là input cho phần "cộng điểm" ở tính năng #1.
4. Gate các hành động tạo template/cycle (`CROSS_ASSESS`), approve/reject
   (`APPROVE`), sửa assessment sau khi submit (`EDIT`) theo permission
   thay vì chỉ theo `Role` (xem mục 4 bên dưới — cùng số nhưng khác mục,
   xem mục 5 permission).

---

## 5. Phân quyền Admin (REAL, xuyên suốt #2 + #3, ảnh hưởng cả #1)

Không phải mock nữa — nhưng cũng không cần UI cấu hình quyền động ngay;
seed sẵn vài bộ quyền cơ bản là đủ cho vòng này.

- `enum AdminPermission { VIEW, COLLECT, CROSS_ASSESS, APPROVE, EDIT, FULL }`
  trên `User.adminPermissions` (chỉ có ý nghĩa khi `role = COMPANY_ADMIN`;
  `SUPER_ADMIN` mặc định có mọi quyền).
- Cần 1 guard/decorator mới (song song `@Roles()`) check permission cụ
  thể; `FULL` luôn pass như superset.
- Map permission → hành động cần gate:
  - `VIEW` — xem hồ sơ/passport/insight nhân viên khác (#2).
  - `COLLECT` — các hành động admin ghi nhận thông tin nhân sự (#2).
  - `CROSS_ASSESS` — tạo/sửa template, cycle (#3).
  - `APPROVE` — duyệt/từ chối assessment (#3), duyệt/trigger offboarding
    summary (#1).
  - `EDIT` — sửa assessment sau khi submit, sửa phần narrative của
    offboarding summary (#1).
- Seed: `admin@acme.dev` giữ `FULL` (như hiện tại); thêm 2-3 tài khoản
  demo admin khác với bộ quyền hẹp hơn để test (vd. chỉ `VIEW`, hoặc
  `VIEW + APPROVE`) — dùng chung với dropdown login ở mục 0.5.

**Vì sao xuyên suốt:** phần lớn permission gate nằm trong tính năng #3
(assessments), nhưng `APPROVE`/`EDIT` cũng gate hành động admin ở tính
năng #1 (offboarding summary). Nên xây **một chỗ** (helper dùng chung kiểu
`common/access/`), không code lặp ở 2 module.

---

## 6. AI Assistant theo ngữ cảnh từng màn hình (REAL, xuyên suốt)

Không còn là "để nguyên, ngoài phạm vi" — cần mở rộng thật:

- Mỗi màn hình dùng assistant với **1 chủ đề/focus riêng** thay vì 1 chat
  chung chung — vd. màn tạo lộ trình (#1) tự động lấy hồ sơ, skill, goal
  hiện tại của user làm context ngay khi mở, không bắt user tự gõ lại.
- Nếu context chưa đủ để đưa ra đề xuất chính xác, AI phải **hỏi lại**
  user để làm rõ, không được đoán/bịa.
- Về kỹ thuật: mở rộng `backend/src/modules/assistant/` — thêm khái niệm
  "topic/focus" cho `AssistantConversation` (vd. `ROADMAP`, `GENERAL`...),
  mỗi topic có 1 context-builder riêng (giống
  `buildPersonalContext`/`buildRosterContext` đã có, nhưng theo màn hình
  cụ thể thay vì theo role).
- Trang `/assistant` hiện tại (chat chung, 2 ngữ cảnh admin/employee) vẫn
  giữ nguyên — đây là bổ sung thêm các instance "focus" nhúng vào từng
  màn hình, không thay thế.
- Trọng tâm trước mắt: **assistant focus "roadmap"** phục vụ trực tiếp
  tính năng #1 (mục 2). Các màn khác (assessments, employees...) có thể
  làm theo cùng pattern sau nếu cần, không bắt buộc lần này.

---

## 7. Điểm nối cần đồng bộ sớm giữa 2 dev

1. **Ghi điểm khi approve → hiển thị trên hồ sơ** (tính năng #3 → #1):
   thống nhất tên field, đơn vị điểm, hồ sơ đọc điểm này ở đâu — trước khi
   mỗi dev code phần của mình.
2. **Permission primitive** (mục 5): xây một lần, dùng chung — thống nhất
   API của guard/decorator trước khi cả 2 gắn vào route của mình.
3. **Offboarding summary** (mục 2) cần permission `APPROVE`/`EDIT` từ mục
   5 — phần backend của tính năng #1 phụ thuộc vào primitive do bên kia
   dựng, nên cần primitive xong trước hoặc làm song song có thống nhất
   interface sớm.

---

## 8. Mock / UI-only

- **Peer Reviews cũ** (`backend/src/modules/peer-reviews/`, `/peer-reviews`)
  — đã bị thay thế bởi Cross Assessment (mục 0.1), không đầu tư thêm.
- **UI concept switcher** (anime/film/pixel-town) — schema-only, chưa có
  UI, ngoài phạm vi, để sau.

---

## 9. Feature list theo 2 tài khoản demo — User A / User B

Gắn với việc 0.5 (dropdown demo account + seed consistency): cần tối
thiểu 2 persona test xuyên suốt, **cùng 1 company** để kiểm tra tính nhất
quán dữ liệu giữa góc nhìn nhân viên và góc nhìn admin.

### User A — Employee (vd. seed sẵn `alice@acme.dev`, company Acme)

Feature list cần A đi qua hết (tính năng #1 + phần "bị tác động" của #3):

- Import CV/LinkedIn → hồ sơ (`/profile/import`).
- Tự cập nhật certifications/projects/awards (`/profile`).
- Tạo/sửa lộ trình phát triển qua assistant focus "roadmap", theo dõi &
  tick tiến độ milestone/task, xem nhiều lộ trình đã lưu song song
  (`/development-plan`).
- Cross Assessment với vai trò người **được đánh giá** (reviewee) — nhận
  phân công từ Admin, xem điểm sau khi được duyệt.
- Cross Assessment với vai trò người **đi đánh giá** (reviewer) — nếu được
  phân công đánh giá đồng nghiệp khác (không phải B).
- Tự check-in hàng tháng (self assessment).
- **Request** tổng hợp hồ sơ khi kỳ làm việc kết thúc (offboarding
  request) — không tự trigger AI.
- Xem career passport của chính mình, tạo/thu hồi share link, xem trang
  public qua token.

### User B — Company Admin (vd. seed sẵn `admin@acme.dev`, cùng company Acme)

Feature list cần B đi qua hết (tính năng #2 + #3 + phần Admin của #1) —
với bộ quyền `FULL` để test được mọi nhánh permission:

- Xem roster nhân viên, trang insight của A (`/employees`,
  `/employees/[id]`) — permission `VIEW`.
- Xem hồ sơ năng lực & career passport của A bất kỳ lúc nào
  (`/employees/[id]/passport`) — permission `VIEW`/`COLLECT`.
- Tạo Job Requirement, chạy AI match — kỳ vọng thấy A trong kết quả nếu
  skill phù hợp (`/job-requirements`).
- Cấu hình bộ tiêu chí Cross Assessment: nhóm/trọng số/câu hỏi/tần suất
  (`/settings/assessment-templates`) — permission `CROSS_ASSESS`.
- Phân công A vào một cặp đánh giá chéo mỗi cycle (assignment, mục 4 gap
  #2).
- Duyệt/từ chối assessment liên quan đến A — permission `APPROVE` — điểm
  phải ghi ngược vào hồ sơ A.
- Thấy request tổng hợp hồ sơ của A trong hàng đợi, bấm trigger AI, sửa
  phần thông tin nhạy cảm (không sửa được phần đánh giá), rồi duyệt —
  permission `APPROVE` + `EDIT`.

### Kiểm tra consistency (mục đích chính của việc tách 2 user)

- A thuộc company Acme → đăng nhập bằng B (admin Acme) phải thấy **đúng**
  A trong roster/profile/assessment/passport — không thiếu, không lệch.
- Điểm B duyệt (approve) phải phản ánh đúng khi A tự xem hồ sơ của chính
  mình (`/profile`, `/career-passport`) — không có state khác nhau giữa
  2 góc nhìn.
- Nếu seed thêm 1 công ty khác + admin khác (không phải B) — admin đó
  **không được thấy** dữ liệu của A (test cách ly theo `companyId`, đúng
  tinh thần permission ở mục 5).
- Nên set 2 tài khoản này làm mặc định trong dropdown login (mục 0.5) vì
  đây là cặp dùng để test end-to-end thường xuyên nhất.

---

## 10. Đề xuất chia việc cho 2 dev

**Dev A — "Cá nhân" (tính năng #1) + assistant focus "roadmap" (mục 6):**
- `backend/src/modules/competency-profile/`,
  `backend/src/modules/profile-imports/`,
  `backend/src/modules/development-plans/` (milestone/task/goal/roadmap),
  `backend/src/modules/career-passport/` (luồng
  request→approve→trigger, redact, split narrative/evaluation),
  `backend/src/modules/assistant/` (thêm topic "roadmap").
- Frontend: `/profile`, `/profile/import`, `/development-plan` (+ roadmap
  editor trực quan mới, tích hợp assistant), `/career-passport`,
  `/employees/[id]/passport` (thêm khu vực admin duyệt request),
  `/passport/[token]`.

**Dev B — "Tổ chức + Cross Assessment" (tính năng #2 + #3) + permission
primitive (mục 5):**
- `backend/src/modules/users/`, `job-requirements/`, `assessments/` (+
  tần suất, phân công, ghi điểm vào hồ sơ), `common/access/` (permission
  guard/decorator dùng chung — làm sớm để Dev A dùng lại ở mục 2).
- Frontend: `/employees`, `/employees/[id]`, `/job-requirements`,
  `/assessments`, `/assessments/[id]`, `/settings/assessment-templates`.

**Việc nhỏ/chung, ai rảnh trước làm:** login dropdown demo accounts + seed
consistency (mục 0.5), seed permission presets (mục 5, cần Dev B xong
enum trước).

**Tránh conflict:** file hạ tầng dùng chung (mục 1), 2 điểm nối ở mục 7 —
chốt hợp đồng (tên field, shape API) trước khi code song song.
