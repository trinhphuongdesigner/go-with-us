# CareerMate v2 — Review tĩnh sau hợp nhất `main`

Ngày review: 2026-09-12
Worktree: `.claude/worktrees/v2-qa`
Branch: `codex/v2-qa-consolidation`
Base review: `190d7f73abf25e5ab59e5820fc8aa6bcb2b39be5`
HEAD đã khóa: `c1148d6cda34981c7ae59dce5521e06363e744b6`
Diff gồm cả phần chưa commit: 255 file, 54.525 dòng, SHA-256 `8c1bd02ca635f5b77b2764cdf76cc990b804cc6705391bf276a52d0dc47bb462`.

## Kết luận bàn giao

Trạng thái hiện tại: **BLOCKED — chưa giao tester chức năng**.

Code từ `main` và các worktree đã được gom về cùng một candidate, nhưng review tĩnh xác nhận một lỗi leo thang quyền và nhiều lỗi P1 về tenant/role, dữ liệu AI, optimistic locking và luồng company. Không nên xem candidate này là bản QA ổn định cho đến khi xử lý tối thiểu toàn bộ P0/P1 và khóa lại một commit SHA mới.

Theo yêu cầu dừng coding, lượt review này không sửa runtime, không stage/commit phần code đang dở và không chạy Playwright. Kết quả được dùng làm backlog sửa và checklist cho tester sau khi có SHA mới.

## Tính năng mới đã xuất hiện trong candidate

| Nhóm | Tính năng đã thấy trong diff | Trạng thái review |
|---|---|---|
| Company & role | Company membership, chọn workspace công ty, role definition, phân quyền HR/BOD, account management | Đã tích hợp nhưng còn lỗi route, membership, grant mặc định và escalation |
| Profile 360° | Hồ sơ mở rộng, employment, activity, HR recognition request, asset/evidence | Có code; assessment chưa phản chiếu đúng về điểm hồ sơ |
| Nhập hồ sơ | Import nhiều nguồn, preview/chọn từng mục, refine bằng AI, apply một lần | Có luồng; module rich import chưa đáp ứng evidence contract và có thể phá giới hạn collection |
| Lộ trình | WORK/PERSONAL, Milo, nhiều roadmap, milestone/task, AI assistant, chỉnh cây | Có code; delete và save structure có thể tác động sai dữ liệu |
| Assessment | Template/cycle, SELF/PEER/MANAGER, submit/approve/reject, weighted score | Công thức deterministic có; projection sau approve và quyền BOD còn thiếu |
| Passport | Offboarding draft, HR narrative, BOD approve, share token hash/expiry/revoke | Luồng có; AI đang tạo điểm và màn approve không hiển thị toàn bộ snapshot |
| Staffing | Job requirements, people search hội thoại, RAG hồ sơ | Có code; AI đang quyết định điểm/ranking và RAG vượt role hierarchy |
| Dashboard/demo | Milo dashboard dùng live data, single-origin proxy, seed QC/RAG | Có code; chỉ được xem là demo runtime sau khi quality gate lại |

## Findings phải xử lý

### P0 — chặn hợp nhất

| ID | Vấn đề | Vị trí | Tác động | Yêu cầu sửa |
|---|---|---|---|---|
| SEC-01 | HR/BOD có `MANAGE_ROLES` có thể gán cho role quyền mà chính họ không có, kể cả `FULL` | `backend/src/modules/roles/roles.service.ts:27` | Leo thang thành quyền quản trị đầy đủ trong tenant | Chặn grant vượt quyền caller ở service, cấm `FULL` với role được ủy quyền, cập nhật user/role atomically và thêm authorization test |

### P1 — phải sửa trước tester chức năng

| ID | Vấn đề | Vị trí | Tác động | Yêu cầu sửa |
|---|---|---|---|---|
| AUTH-01 | RAG chỉ nhận `company_id`, không áp dụng role hierarchy | `v2/backend/app/people_search/rag.py:143` | HR đọc được skill note/project/experience của HR ngang cấp hoặc BOD; dữ liệu còn được gửi sang AI | Truyền actor/allowlist và lọc trước khi tạo evidence |
| AUTH-02 | Conversation tạo khi chưa có `PEOPLE_READ` không đổi `uses_roster` khi sau đó chứa roster answer | `v2/backend/app/career_ai/routes.py:516` | Thu hồi quyền vẫn đọc/replay được lịch sử nhân sự | Đánh dấu conversation trước khi lưu roster answer hoặc buộc tạo conversation mới |
| AUTH-03 | `GET /companies/mine` của Nest không cho `COMPANY_ADMIN` | `backend/src/modules/companies/companies.controller.ts:52` | Sidebar ẩn workspace công ty của company admin | Cho role này qua endpoint và test phiên company admin |
| AUTH-04 | Account/company mới trong Nest không tạo `CompanyMembership` | `backend/src/modules/users/users.service.ts:159`, `backend/src/modules/companies/companies.service.ts:105` | User mới không vào được company workspace nếu không chạy seed lại | Tạo membership trong cùng transaction với account/company |
| AUTH-05 | Link talent có `companyId=B` nhưng `useTalentScope()` bỏ qua URL và dùng công ty chính A | `v2/frontend/src/features/talent-workflows/shared.tsx:30` | Xem hoặc ghi requirement/assessment vào sai tenant đang chọn | Đồng bộ URL với selector và từ chối companyId không thuộc allowlist |
| AUTH-06 | BOD tạo qua API không có `ASSESSMENT_REVIEW`; HR không có `PASSPORT_APPROVE` | `v2/backend/app/organization.py:43` | BOD không duyệt assessment, HR không sửa narrative như contract | Sửa default grants và kiểm tra account tạo thật, không dựa vào seed cấp toàn quyền |
| CON-01 | Company đã được load khi xác thực; query `FOR UPDATE` có thể vẫn dùng version cũ trong identity map | `v2/backend/app/organization.py:162` | Hai lần sửa company có thể cùng chấp nhận một `expectedVersion` và mất update | `populate_existing=True` hoặc atomic update theo version |
| CON-02 | `create_account()` đọc role grants mà không dùng company lock như `patch_role()` | `v2/backend/app/organization.py:262` | Account mới có thể giữ grant vừa bị thu hồi | Dùng cùng lock hoặc lấy role definition làm nguồn quyền duy nhất |
| CON-03 | Goal update không có version/`expectedVersion` | `v2/backend/app/career_ai/routes.py:133` | Hai tab ghi đè status/progress/target âm thầm | Thêm optimistic locking và trả 409 khi stale |
| UI-01 | Delete dialog giữ boolean nhưng mutation đọc roadmap đang chọn | `v2/frontend/src/features/roadmap/persisted-roadmap-view.tsx:160` | Chọn A để xóa, chuyển sang B rồi confirm sẽ xóa B | Giữ `{id, version, title}` của mục cần xóa trong state |
| UI-02 | Editor giữ draft cũ nhưng Save lấy version mới nhất; checkbox bên dưới vẫn hoạt động | `v2/frontend/src/features/roadmap/persisted-roadmap-view.tsx:159` | Save structure có thể hoàn tác task vừa complete hoặc ghi đè update mới | Khóa version cùng draft và chặn/thông báo conflict |
| UI-03 | `/my-companies/{id}` được push nhưng không có page/redirect | `frontend/src/app/my-companies/page.tsx:117` | Click company đi tới 404 | Thêm landing page hoặc chuyển link tới child route hợp lệ |
| AI-01 | RAG chấp nhận `answer` tự do khi `candidate_reasons=[]` | `v2/backend/app/people_search/rag.py:356` | Câu khẳng định không citation vẫn hiện `answer_source=ai`, `status=ok` | Bắt buộc claim có candidate/evidence refs và dựng answer từ claim đã validate |
| AI-02 | `source_type != SELF` bị coi là verified dù employee đã sửa nội dung có nguồn ADMIN/IMPORT | `v2/backend/app/people_search/rag.py:185` | Nội dung tự sửa được gắn nhãn “Đã xác minh” | Gắn verification với version được duyệt và vô hiệu khi nội dung đổi |
| AI-03 | Rich import chỉ validate shape, không lưu/kiểm tra evidence block cho từng fact | `v2/backend/app/rich_profile_import/routes.py:123` | Skill/project/certificate bịa có thể được apply | Đi qua evidence gateway; thiếu nguồn phải `insufficient_evidence` hoặc yêu cầu user sửa rõ ràng |
| AI-04 | Skill không có level được mặc định thành 3 | `v2/backend/app/rich_profile_import/schemas.py:70` | Tạo rating không có trong tài liệu | Cho phép `null`, giữ support status và bắt user chọn trước apply |
| AI-05 | Assistant bỏ ID lạ nhưng giữ nguyên câu trả lời chứa claim lạ | `v2/backend/app/career_ai/routes.py:494` | Hallucination vẫn được persist và hiển thị | Reject toàn bộ response có entity/claim không được evidence cho phép |
| AI-06 | Offboarding yêu cầu AI tạo năm dimension score rồi khóa chúng | `v2/backend/app/talent_workflows/router.py:657` | Điểm chính thức có thể bị bịa; trái contract deterministic | Tính điểm từ immutable snapshot bằng code; dimension thiếu dữ liệu phải unsupported |
| AI-07 | `career_context()` bỏ question/answer/comment/assessment ID trước khi tóm tắt | `v2/backend/app/talent_workflows/service.py:206` | Không thể citation hoặc giữ bất đồng; offboarding thiếu bằng chứng | Truyền evidence đã phân quyền và validate citation/disagreement |
| AI-08 | Job matching cho AI quyết định `matchScore` và sort cuối | `v2/backend/app/talent_workflows/router.py:963` | Ứng viên thiếu required skill vẫn có thể đứng đầu 100% | Backend áp hard filter và tính score/breakdown; AI chỉ giải thích |
| DATA-01 | Approve assessment chỉ cập nhật Assessment, không phản chiếu điểm vào profile | `v2/backend/app/talent_workflows/router.py:428` | Profile/dashboard vẫn 0 hoặc dữ liệu manual sau khi duyệt | Cập nhật projection/average trong cùng transaction hoặc trong read model xác định |
| DATA-02 | Màn BOD approve passport không hiện strengths, growth areas và dimension scores trước khi đóng băng | `v2/frontend/src/features/talent-workflows/passport.tsx:63` | Người duyệt ký xác nhận dữ liệu chưa được nhìn thấy | Hiện toàn bộ prospective public snapshot trước nút approve |
| DATA-03 | Rich import insert ORM trực tiếp, bỏ qua giới hạn 200 item của profile service | `v2/backend/app/rich_profile_import/routes.py:380` | Có thể tạo item thứ 201 rồi làm các endpoint profile trả 422 | Dùng service/domain operation chung và kiểm tra kích thước trước insert |
| RUNTIME-01 | Project description hợp lệ tới 4.000 ký tự nhưng RAG excerpt tối đa 1.200 | `v2/backend/app/people_search/rag.py:230` | Một hồ sơ dài có thể làm `/people-search/ask` lỗi cho cả tenant | Cắt/chunk trước khi tạo DTO và cô lập lỗi từng segment |
| PERF-01 | RAG tải toàn bộ user + toàn bộ skill/experience/project rồi mới limit 8 | `v2/backend/app/people_search/rag.py:149` | Memory/CPU/DB tăng theo toàn tenant; timeout AI không bao phủ retrieval | Tìm kiếm/bound candidate trong DB trước khi dựng evidence |
| PERF-02 | Job matching gọi `career_context()` cho tối đa 200 user rồi chỉ giữ skills | `v2/backend/app/talent_workflows/router.py:919` | Tới 600 query nối tiếp và hàng chục nghìn record thừa | Batch skill query theo candidate IDs |
| PERF-03 | General assistant gọi 4 query nối tiếp cho từng người, tối đa 80 người | `v2/backend/app/career_ai/routes.py:451` | Tới 320 DB round trip trước provider | Batch context theo user IDs |
| PERF-04 | Assessment list gọi user lookup cho reviewer và reviewee từng row | `v2/backend/app/talent_workflows/service.py:102` | Queue 500 item có thể tạo gần 1.000 query | Join alias hoặc batch distinct user IDs |
| PERF-05 | Async AI path gọi `socket.getaddrinfo()` đồng bộ | `v2/backend/app/career_ai/provider.py:56` | DNS chậm chặn event loop và không nằm trong timeout HTTP | Resolve async/to_thread với deadline |
| PERF-06 | URL import chỉ có socket inactivity timeout, không có total deadline | `v2/backend/app/rich_profile_import/sources.py:117` | Slow stream giữ request và worker thread không giới hạn tổng thời gian | Áp monotonic deadline cho DNS/redirect/read từng chunk |
| PERF-07 | Refine import giữ `FOR UPDATE` trong lúc chờ AI | `v2/backend/app/rich_profile_import/routes.py:221` | Khóa row và giữ connection suốt provider timeout | Chụp version, gọi AI ngoài lock, lock lại rồi revalidate trước save |

### P2 — sửa trước khi gọi candidate ổn định

| ID | Vấn đề | Vị trí | Hướng xử lý |
|---|---|---|---|
| CACHE-01 | Apply import invalidate `['profile']`, trong khi màn hồ sơ dùng `['core-profile', userId]` và nhiều key mở rộng | `v2/frontend/src/features/profile-rich-import/rich-import-view.tsx:47` | Dùng query-key helper chung và invalidate đúng các resource đã ghi |
| CONTRACT-01 | Personal-details endpoint không có response model/return type; generated OpenAPI là `unknown` | `v2/backend/app/profile_extensions/router.py:180` | Thêm `PersonalDetailsRead` và sinh lại client |
| QUALITY-01 | `mypy strict = true` bị hạ xuống một tập tùy chọn nhỏ | `v2/backend/pyproject.toml:46` | Bật strict lại, annotate các route/service helper mới |
| QUALITY-02 | Roadmap PUT/DELETE gọi private `service._roadmaps()` và đặt persistence trong route | `v2/backend/app/api/v2/development_plans.py:67` | Đưa mutation/lock/version/commit về public service method |
| PERF-08 | `send_chat()` dùng cùng DB session trong thời gian gọi provider | `v2/backend/app/career_ai/provider.py:68` | Tách bước đọc config khỏi provider call; đóng transaction trước network |

## Quality gate cần chạy sau khi sửa

1. Khóa một commit SHA duy nhất; không test trên working tree thay đổi.
2. Static: Ruff, mypy strict, backend unit/integration, ESLint và TypeScript.
3. Migration/seed: database sạch và database đã seed; chạy seed hai lần để kiểm tra idempotency.
4. RBAC: role editor escalation, BOD approve, HR narrative, company admin navigation, membership của account mới.
5. Tenant: primary A + membership B, query string B phải đọc/ghi đúng B; HR không đọc peer HR/BOD qua RAG.
6. Concurrency: company patch, role grant/account create, goal update, roadmap structure/task và import refine/apply.
7. AI: invalid ID, claim thiếu evidence, empty citations, prompt injection, timeout, long project description, missing skill level.
8. Functional browser test sau khi user cho phép lại: company workspace, profile import, roadmap edit/delete, assessment approve, passport approve/share, job matching và people search.

## Quy tắc tiếp tục

- Không merge `master`, force-push, xóa worktree hoặc chạy migration production.
- Không commit chung các thay đổi runtime hiện còn dở chỉ để đưa tài liệu này lên branch.
- Sau khi owner sửa, review lại diff mới trên đúng SHA; findings đã sửa phải có test hồi quy.
- Tester chỉ nhận URL, account matrix, seed SHA/database name và danh sách known limitations sau khi P0/P1 đạt.
