# Dev B — Backend contract

Phạm vi: permission Admin, duyệt Cross Assessment → điểm hồ sơ, và quyền trong luồng offboarding theo `../docs/careermate-work-split.md` (0, 3, 4, 5, 7). Không thay UI trong phần backend này.

## Quyền

`User.adminPermissions: AdminPermission[]` gồm `VIEW`, `COLLECT`, `CROSS_ASSESS`, `APPROVE`, `EDIT`, `FULL`. `FULL` bao gồm mọi quyền; `SUPER_ADMIN` luôn có mọi quyền. Grant trên `EMPLOYEE` không có tác dụng. Permission không vượt qua scope công ty.

JWT strategy đọc permission từ DB ở mỗi request; thu hồi quyền có hiệu lực cả với token đã cấp. Login và `/api/auth/me` trả `adminPermissions` để frontend dùng. Không có API tự cấp quyền hay UI cấu hình quyền động.

Dùng `@RequirePermission(AdminPermission.APPROVE)` sau `JwtAuthGuard` cho route Admin. Decorator tự gắn `PermissionsGuard`. Route chung với employee (ví dụ sửa hồ sơ bản thân, sửa assessment draft) kiểm tra điều kiện trong service qua `assertAdminPermission`; quyền công ty vẫn kiểm tra riêng.

| Permission | Hành động |
| --- | --- |
| VIEW | Roster, hồ sơ/passport/insight/skills/activity của người khác; matching và assistant staffing, kể cả lịch sử hội thoại staffing |
| COLLECT | Admin tạo/sửa/xóa nhân sự, ghi nhận employment cho nhân sự khác; ghi yêu cầu dự án |
| CROSS_ASSESS | Quản lý template/cycle; Admin ghi assessment cho người khác, assessment loại MANAGER |
| APPROVE | Hàng đợi, approve/reject assessment; hàng đợi, trigger/approve offboarding |
| EDIT | Sửa assessment đã SUBMITTED; sửa narrative của offboarding đã generate và còn DRAFT |

Người có APPROVE hoặc EDIT được đọc assessment cùng công ty để thực hiện việc được giao, không cần thêm quyền xem toàn bộ hồ sơ. Employee vẫn sửa được assessment DRAFT/REJECTED do mình viết. Bài APPROVED không được sửa, kể cả FULL.

Seed có `admin@acme.dev` = FULL, `viewer@acme.dev` = VIEW, `approver@acme.dev` = VIEW + APPROVE, `assessor@acme.dev` = VIEW + COLLECT + CROSS_ASSESS + EDIT. Tất cả thuộc cùng Acme với Alice/Bob/Carol và dùng mật khẩu demo có sẵn trong seed. Admin của công ty mới được tạo qua CompaniesService có FULL. Account Admin mới tạo trực tiếp qua UsersService mặc định không có grant; vòng này dùng seed để cấp bộ quyền.

## Điểm và lịch sử

`AssessmentGroup.scoreDimension` là `CONTRIBUTION` (mặc định) hoặc `ATTITUDE`; builder API nhận field này trong mỗi group. Không đoán trục từ tên nhóm. Template demo gắn nhóm “Attitude & collaboration” vào ATTITUDE.

1. Chuẩn hóa mỗi câu: `score / maxScore * 10`.
2. Trung bình câu trong nhóm theo trọng số câu.
3. Trung bình nhóm theo trọng số nhóm: tất cả nhóm cho `totalScore`; từng trục cho `contributionScore` và `attitudeScore`.
4. Approve tính lại từ câu trả lời, lưu snapshot toàn bộ template, rồi cập nhật hai field cùng tên trên `User` bằng trung bình các bài APPROVED theo trục. Không có trọng số riêng theo reviewer hoặc cycle. Trục chưa có bài chấm trả null, không giả định một điểm trung lập.

Điểm lưu theo thang 0–10, làm tròn hai chữ số thập phân. `GET /api/competency-profile`, `/api/career-passport` trả điểm trong `user`; insight và users cũng đọc hai field này. Thao tác submit/edit/approve là transaction; approval dùng Serializable và retry conflict để không mất điểm khi duyệt đồng thời. Nhân sự không tự sửa điểm tổ chức qua PATCH users.

Câu trả lời phải thuộc template, không trùng ID, nằm trong `[1, maxScore]`. Submit/approve yêu cầu trả lời mọi câu có trọng số dương. Dữ liệu không hợp lệ không làm mất câu trả lời cũ.

**Template đã có cycle hoặc assessment:** PATCH thay đổi tên/mô tả/nhóm sẽ archive phiên bản cũ và trả về **template mới với ID mới, version tăng 1**, mặc định DRAFT. Frontend phải dùng ID trong response để chỉnh sửa tiếp hoặc mở cycle mới. Cycle đang tồn tại giữ ID template cũ. Đổi status đơn thuần không tạo bản sao. Delete template đã dùng chỉ archive. Cách này giữ nguyên cả snapshot lẫn câu hỏi/câu trả lời quá khứ.

## Offboarding

- Employee: `POST /api/career-passport/summaries/request` với `{ employmentId }` của chính mình → DRAFT; không gọi AI.
- APPROVE: `POST /api/career-passport/summaries/:id/trigger` → generate một lần, vẫn DRAFT. Phải có assessment đã duyệt trong employment đó. Quyền công ty lấy từ employment nên vẫn đúng sau khi employee rời tổ chức.
- EDIT: `PATCH /api/career-passport/summaries/:id` với `{ content }` chỉ sửa narrative. `evaluation`, `dimensionScores`, `strengths`, `growthAreas` không nằm trong update DTO và không được ghi bởi endpoint này.
- APPROVE: `POST /api/career-passport/summaries/:id/approve` → APPROVED. Không duyệt trước generate; không generate lại để ghi đè đánh giá; không sửa sau duyệt. Conditional writes chặn ghi đè khi các request chạy đồng thời.

Tên dự án và tổ chức đã có trong dữ liệu được thay bằng nhãn trước khi gửi AI và được lọc lại trong mọi trường text trước khi lưu. Prompt yêu cầu mô tả khách hàng theo cách tổng quát. Schema chưa có danh mục tên khách hàng riêng để lọc xác định những tên chỉ xuất hiện trong văn bản tự do; Admin cần rà bản nháp. `SELF_REQUESTED` vẫn là bản tự thuật riêng, không thể đổi nguồn thành `ORGANIZATION_OFFBOARDING` qua endpoint save.

## Migration và kiểm tra

Migration: `prisma/migrations/20260911130000_dev_b_permissions_scores/migration.sql`.

- Admin cũ được backfill FULL để giữ quyền đang có; account mới mặc định `[]`.
- Template cũ chưa có mapping trục: điểm totalScore đã duyệt hợp lệ được giữ làm CONTRIBUTION; không suy diễn điểm ATTITUDE. Snapshot cũ không bị ghi lại.
- Cần áp dụng migration vào DB dự án theo quy trình hiện tại trước khi chạy backend mới. Prisma generate và build không tự cập nhật DB.

```sh
npx prisma generate
npm run build
npm test -- --runInBand
```

Integration suite dùng HTTP/Nest/JWT/Prisma/PostgreSQL thật; chỉ mock biên `AiChatService.send` để không gọi provider/tốn token. Cần Node hỗ trợ Jest require(ESM) (môi trường đã kiểm tra: Node 26), PostgreSQL local riêng cho test, DB tên `dev_b_test`:

```sh
# Chỉ trỏ tới DB local tạm dành riêng cho test.
export DEV_B_TEST_DATABASE_URL='postgresql://LOCAL_USER@127.0.0.1:LOCAL_PORT/dev_b_test'
DATABASE_URL="$DEV_B_TEST_DATABASE_URL" npx prisma db push --skip-generate
npm run test:dev-b
```

Suite kiểm tra quyền hẹp/FULL/SUPER_ADMIN và scope công ty, thu hồi permission trên token cũ, tính điểm và duyệt đồng thời, template history, validate/rollback, offboarding request/trigger/edit/approve, ẩn tên và phản hồi AI lỗi. Fixture là dữ liệu giả có ID riêng từng test. Không dùng DB dự án/production để chạy suite.
