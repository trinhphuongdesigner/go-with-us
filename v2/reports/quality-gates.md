# CareerMate v2 — Quality Gate Matrix

## 1. Quy tắc trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| PASS | Lệnh đã chạy trên đúng `implementation_sha`, exit code `0`, output/artifact chứng minh yêu cầu đạt |
| FAIL | Lệnh đã chạy, hoàn tất và chứng minh yêu cầu không đạt |
| BLOCKED | Không thể chạy do phụ thuộc bên ngoài có thật: DB test không sẵn sàng, provider lỗi, quota, thiếu binary hoặc quyền |
| NOT_RUN | Chưa chạy. Không được diễn đạt như PASS hoặc “có vẻ ổn” |

`BLOCKED` phải ghi `blocker`, bằng chứng kiểm tra blocker, ảnh hưởng và bước retry. Không đổi `BLOCKED` thành `PASS` chỉ vì agent đọc code và thấy hợp lý. Coverage 80% sẽ được bật khi Wave 1 có domain/service hoàn chỉnh; Wave 0 không ghi coverage PASS.

## 2. Exact-SHA evidence

Mỗi feature dùng hai commit:

1. Commit implementation, lấy `implementation_sha`.
2. Chạy toàn bộ gate trên commit đó, tạo report ghi `implementation_sha`.
3. Commit report riêng. Vì report tự tham chiếu nên `evidence_commit_sha` và `remote_sha` được ghi trong ledger bàn giao ngoài report hoặc GitHub check.

Lệnh bắt buộc trước và sau test:

```bash
cd .claude/worktrees/<feature-worktree>
export CAREERMATE_FEATURE_SHA="$(git rev-parse HEAD)"
git status --short
git diff --check
test "$(git rev-parse HEAD)" = "$CAREERMATE_FEATURE_SHA"
git show --stat --oneline "$CAREERMATE_FEATURE_SHA"
```

Điều kiện:

- Trước gate, worktree phải sạch hoặc chỉ có artifact test đã ignore.
- Sau gate, `HEAD` vẫn bằng `CAREERMATE_FEATURE_SHA`.
- Không dùng kết quả của SHA cũ cho commit mới.
- Sau push:

```bash
git fetch origin feat/v2-rebuild
git rev-parse HEAD
git rev-parse origin/feat/v2-rebuild
```

Hai SHA phải trùng mới được ghi “đã push”.

## 3. Gate nền tảng dùng chung

Giả định cấu trúc:

- Backend: `v2/backend`, Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, uv.
- Frontend: `v2/frontend`, Next.js 16, React 19, Tailwind CSS 4, npm.
- E2E: `v2/frontend/e2e`.
- Backend local: `http://127.0.0.1:3100`.
- Frontend local: `http://127.0.0.1:3101`.

### Backend static/unit/integration

```bash
cd v2/backend
uv sync --frozen --all-extras
uv run ruff format --check .
uv run ruff check .
uv run mypy app scripts
uv run pytest -q
```

Coverage 80% là gate cho domain/service mới; không tạo test chỉ để đạt số. Mọi rule quyền, company isolation, AI validation và transaction phải có test behavior.

### Database/migration

Chỉ dùng PostgreSQL test riêng.

```bash
cd v2/backend
uv run alembic upgrade head
uv run alembic check
uv run pytest tests/integration -q --junitxml=reports/integration.xml
```

Các migration test bắt buộc:

- Database rỗng → `upgrade head`.
- Seed chạy hai lần không tạo dữ liệu trùng.
- Company A không đọc/ghi dữ liệu Company B.
- Transaction lỗi giữa chừng không để partial state.
- Không chạy downgrade hoặc migration trên DB v1/production trong overnight build.

### API contract

```bash
cd v2/backend
uv run python scripts/export_openapi.py --check contracts/openapi.json
uv run pytest tests/contract -q
```

Gate thất bại nếu response runtime khác Pydantic/OpenAPI contract hoặc AI proposal chứa field ngoài schema.

### Frontend

```bash
cd v2/frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Không dùng production build thay thế component/behavior tests.

### Playwright critical path

Khởi động backend/frontend bằng process riêng, ghi PID và log vào thư mục temp; không dùng server không rõ SHA.

```bash
cd v2/frontend
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 \
API_BASE_URL=http://127.0.0.1:3100 \
npx playwright test \
  --project=chromium \
  --reporter=line,html
```

Mỗi feature phải có happy path, permission/failure path và kiểm tra console error/network 5xx.

### Accessibility

Tích hợp `@axe-core/playwright` trong spec, rồi chạy:

```bash
cd v2/frontend
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 \
npx playwright test --project=chromium
```

Gate:

- Không có axe violation mức `serious` hoặc `critical`.
- Keyboard đi được toàn flow.
- Focus visible.
- Dialog giữ và trả focus đúng.
- Form có label/error liên kết.
- Text/control đạt WCAG AA.
- Không dùng màu làm tín hiệu duy nhất.
- Test viewport 390×844, 768×1024, 1440×900.

### Security/dependency/secrets

```bash
cd v2/backend
uv run python -m bandit -r app -x tests -ll
uv run python -m pip_audit --strict

cd ../frontend
npm audit --omit=dev --audit-level=high

cd ../..
bash v2/scripts/install-gitleaks.sh
v2/.tools/gitleaks git . --log-opts "$(git merge-base origin/master HEAD)..HEAD" --redact --exit-code 1
```

Nếu `pip-audit`, `pnpm audit` hoặc gitleaks chưa cài/không có network: ghi `BLOCKED`, không ghi PASS. Report/log không chứa token, password, CV thật hoặc plaintext API key.

### Performance

API dùng dữ liệu seed tối thiểu 100 nhân viên, 500 skills, 200 assessments. Ghi p50/p95 và error rate:

```bash
cd v2/backend
uv run pytest tests/performance -q --benchmark-json=reports/benchmark.json

cd ../frontend
pnpm exec lhci autorun
```

Ngưỡng overnight:

- Non-AI API p95 < 300 ms trên demo dataset; Wave 0 đo auth và các wave sau bổ sung profile/roster.
- AI endpoint không tính thời gian provider vào API CRUD budget; timeout và fallback phải test riêng.
- LCP ≤ 2.5 s, CLS ≤ 0.1, INP lab proxy ≤ 200 ms trên trang chính.
- Không có request waterfall lặp vô hạn hoặc payload roster không giới hạn.

## 4. Matrix theo feature

| Feature | Backend gates bắt buộc | Frontend/E2E gates bắt buộc | AI/Security gates | Hoàn thành khi |
|---|---|---|---|---|
| Foundation/Auth/Seed | login success/failure, JWT hết hạn, role, company isolation, seed idempotent, migration clean | demo-account switch, protected-route redirect, logout, mobile login | password hash, secret redaction, rate-limit behavior | Hai persona login được và không vượt quyền |
| Profile/Admin roster | owner CRUD/read, admin VIEW, cross-company 403, pagination | employee profile, admin roster/detail, empty/loading/error, 390/768/1440 | Không gửi dữ liệu công ty khác vào context | Cùng một employee hiển thị nhất quán ở hai vai trò |
| CV import | parse proposal không ghi DB, selective apply, duplicate normalization, transaction rollback | upload/paste, review/edit/select/apply, invalid/large file | malformed output, invented fields, prompt injection, PII logs, provider timeout | Dữ liệu chỉ thay đổi sau Apply |
| Roadmap | context builder, `needs_clarification`, schema validation, save tree transaction | assistant → clarification → editable Milo journey → reorder/save/reload | invented skill rejection, invalid date/task, empty provider, proposal-only | Reload giữ đúng tree người dùng đã duyệt |
| Cross Assessment | assignment, no self/unassigned review, weighted score, snapshot, submit/approve/reject permissions, concurrent approve | assigned list, form validation, admin approval, employee score refresh | Không cần AI để tính điểm; mọi điểm deterministic | Approve cập nhật hồ sơ đúng một lần |
| Dashboard | role-scoped aggregate, zero-data state | Employee/Admin cards, navigation, responsive | Không lộ aggregate công ty khác | Các card khớp dữ liệu API/seed |
| Passport/Offboarding | token expiry/revoke, owner consent, org-source immutable evaluation, editable narrative only | request/queue/trigger/approve/public read-only | redact tên dự án/khách hàng trước và sau AI, grounding từ assessment APPROVED | Link hết hạn/revoke bị chặn và evaluation không sửa được |
| Job matching/Assistant | roster bounds, allowed-ID hydration, conversation ownership | query, clarification, referenced employee links, retry | fabricated ID dropped, insufficient context asks back, prompt injection, timeout | Kết quả chỉ tham chiếu employee hợp lệ cùng company |

## 5. Review UI theo persona

Antigravity chỉ review read-only và trả finding có severity:

- `P0`: blocker, mất dữ liệu, vượt quyền, không hoàn thành task.
- `P1`: lỗi flow, accessibility serious/critical, mobile unusable.
- `P2`: polish/copy/spacing, có thể đưa backlog.

Persona:

1. Nhân viên 22–30: tốc độ, task discovery, mobile.
2. HR 35–45: scan dữ liệu, bulk/approval clarity.
3. Quản lý 45–55: font, contrast, thuật ngữ, quyết định rõ.
4. Người ít dùng công nghệ: không đoán icon, có hướng dẫn, lỗi phục hồi được.

Chỉ P0/P1 chặn commit overnight. P2 được ghi vào report.

## 6. Quy tắc kết luận

`overall_status`:

- `PASS`: mọi required gate PASS.
- `FAIL`: có ít nhất một required gate FAIL.
- `BLOCKED`: không có FAIL nhưng có required gate BLOCKED.
- `NOT_RUN`: chưa chạy gate bắt buộc.

Không tính trung bình và không cho PASS nếu một required gate là BLOCKED/NOT_RUN.
