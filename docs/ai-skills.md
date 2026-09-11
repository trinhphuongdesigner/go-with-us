# AI Skills — quy ước bắt buộc cho mọi tính năng dùng AI

Tài liệu này chốt quy ước cho **mọi** endpoint gọi AI trong CareerMate — thay
thế cho việc mỗi tính năng tự vá prompt/parse rời rạc theo thời gian. Đây là
file để **đọc trước khi thêm hoặc sửa bất kỳ "AI skill" nào**, và để **sửa
trực tiếp khi quy ước thay đổi** — code bám theo file này, giống cách
`docs/careermate-scope.md` là nguồn sự thật cho scope dữ liệu.

---

## 1. AI skill là gì

Một **AI skill** là một endpoint gọi `AiChatService.send()` để biến input của
người dùng (hoặc dữ liệu đã có trong hệ thống) thành một **đề xuất có cấu
trúc**, rồi trả đề xuất đó về cho người dùng xem xét — **không tự ghi DB**.

Nguyên tắc gốc (đã có trong `CLAUDE.md`): *"AI features are a proposal, never
self-persisting"*. Người dùng luôn phải có một hành động tường minh (nút
"Lưu"/"Apply") ở một endpoint **khác** để dữ liệu thực sự được ghi. Hai ví dụ
gốc: `POST /development-plans/generate` (đề xuất) → `PUT
/development-plans/me` (lưu + snapshot version). Ngoại lệ duy nhất đã ghi
nhận từ đầu: `POST /job-requirements/:id/match` — đây là phân tích xếp hạng
chỉ-đọc, không phải một tài liệu, nên trả thẳng không có bước lưu.

**Mọi module đều phải gọi qua `AiChatService`** (`backend/src/modules/ai-chat/`)
— không module nào được gọi thẳng SDK của Anthropic/OpenAI/Gemini.

---

## 2. Pipeline bắt buộc (6 bước)

Mỗi AI skill — dù là method riêng trong service nào — phải theo đúng 6 bước
sau, theo thứ tự:

1. **Thu thập context read-only.** Chỉ đọc dữ liệu cần thiết từ DB (snapshot
   hiện tại của user, danh sách candidate hợp lệ, v.v.) — không ghi gì ở
   bước này.
2. **Build system prompt** với JSON-shape khóa cứng (ví dụ cụ thể trong
   prompt: `Reply with ONLY a JSON object of this exact shape, no prose, no
   markdown code fences: {...}`) + một khối "rules" liệt kê các ràng buộc
   bắt buộc. Khối rules **luôn luôn** phải có rule LANGUAGE — ví dụ chuẩn từ
   `profile-imports.service.ts`:

   > `LANGUAGE: Reply in the same language the user's sources/instruction are
   > written in (Vietnamese sources → Vietnamese proposal fields).`

   Khi skill cần dedupe hoặc xác minh danh tính, thêm rule tương ứng nhưng
   **để quyết định tiếp tục/bỏ qua cho người dùng**, không để AI tự quyết âm
   thầm. Ví dụ chuẩn — field `identityCheck` trong
   `profile-imports.service.ts`'s `buildAnalysisPrompt`:

   ```
   "identityCheck": { "detectedSourceName": "<tên trong NGUỒN MỚI, rỗng nếu không có>", "matches": true|false },
   ...
   - Set "identityCheck.matches" to false if that name clearly refers to a
     different person... This field is for the UI to ask the user for
     confirmation — it must NOT influence which items you include in the
     proposal above.
   ```

   AI vẫn phải trả **đầy đủ** đề xuất bất kể `matches` là gì; UI
   (`ConfirmDialog`) là nơi hỏi người dùng có tiếp tục hay không — xem
   `frontend/src/app/profile/import/page.tsx`.

3. **Gọi `AiChatService.send()`** — đây là điểm vào duy nhất. `send()` đã tự
   xử lý lỗi provider/network (`ServiceUnavailableException`/
   `BadGatewayException`), nên phía dưới chỉ cần xử lý một `content: string`
   không rỗng.
4. **Parse reply qua `ai-reply.utils.ts`** (`backend/src/modules/ai-chat/`)
   — dùng `parseJsonReplyOrThrow` (hoặc `stripJsonFence` riêng nếu skill cần
   fallback thay vì throw, xem mục 3) thay vì tự viết lại regex strip fence.
5. **Validate/coerce từng field** bằng `asString`/`asArray`/`asStringArray`
   (dùng chung) hoặc coercion đặc thù của skill (ví dụ: clamp điểm số) —
   xem mục 3 để biết khi nào một skill có coercion riêng thay vì dùng chung.
6. **Trả đề xuất** — không ghi DB (trừ 2 ngoại lệ đã ghi nhận ở mục 4).

---

## 3. Bảng 5 AI skill hiện có

| Skill | Entry point | Context thu thập | Return shape | Rule đặc biệt | Endpoint lưu |
|---|---|---|---|---|---|
| Development Plan | `POST /development-plans/generate` → `generatePlan()` | Skills/goals/activities hiện tại của user | `{ planMd, summary }` (markdown tự do, fence **anchored**) | — | `PUT /development-plans/me` |
| Job Requirement Matching | `POST /job-requirements/:id/match` → `matchCandidates()` | Requirement + danh sách candidate hợp lệ trong company | `{ matches: [{userId, matchScore, rationale}], summary }` | Lọc bỏ `userId` không nằm trong candidate list gửi đi (chống hallucination) | Không có — đây là kết quả chỉ-đọc |
| Profile Import — CV parse (legacy) | `POST /profile-imports/:id/parse` → `parseReply()` | Raw text CV/LinkedIn đã lưu trên job | `{ profile, skills, certifications, projects, awards, summary }` | Throw nếu không tìm thấy gì hữu ích (`nothingFound`) | `POST /profile-imports/:id/apply` |
| Profile Import — Rich update | `POST /profile-imports/analyze` → `analyzeSources()` / `POST /profile-imports/refine` → `refineProposal()` | Snapshot hồ sơ hiện tại của user + nguồn mới (url/text/file) | `{ identityCheck, basicInfo, skills, projects, certifications, awards, activities, goals, roadmap, summary, dedupNotes }` | LANGUAGE + `identityCheck` (mục 2) + dedupe theo CURRENT SNAPSHOT | `POST /profile-imports/apply-rich` |
| AI Assistant | `POST /assistant/query` → `query()` | Lịch sử hội thoại nhiều lượt + roster/hồ sơ theo quyền người hỏi | `{ answer, referencedUserIds, proposal? }` | **Không throw khi parse lỗi** — fallback trả câu trả lời dạng plain-text thay vì JSON (dùng `stripJsonFence` only, không dùng `parseJsonReplyOrThrow`) | Không có — trợ lý hội thoại |
| Career Passport — Summary | `career-passport.service.ts` → `generateSummary()` | Employment period + dữ liệu liên quan | `{ content, strengths, growthAreas, summary }` | — | Endpoint lưu `CareerSummary` riêng (explicit save) |
| Career Passport — Offboarding | `career-passport.service.ts` → `triggerOffboardingSummary()` | Employment period sắp kết thúc (đã redact qua `offboardingRedactor`) | `{ narrative, evaluation, dimensionScores, strengths, growthAreas }` | `clampScore` cục bộ (ép `Number(v)`, mặc định trung tính 5, làm tròn 1 chữ số thập phân) — **không** dùng `asClampedNumber` dùng chung | Ghi `updateMany` ngay trong `triggerOffboardingSummary` — xem ngoại lệ ở mục 4; bước "lưu tường minh" thật sự là `approveOffboardingSummary` riêng |

Lưu ý: profile-imports skill-level clamp (`typeof === 'number'` nghiêm ngặt,
làm tròn số nguyên, `undefined` khi thiếu) và career-passport dimension-score
clamp (nêu trên) là hai coercion **khác nhau thật sự** — cả hai đều **không**
được gộp vào `asClampedNumber` dùng chung để tránh đổi hành vi. `asClampedNumber`
tồn tại cho skill **mới** dùng, không retrofit vào code hiện tại.

---

## 4. Hai ngoại lệ ghi DB trực tiếp (đã ghi nhận)

Hai luồng sau **không** theo đúng "proposal only" vì lý do cụ thể — bất kỳ
skill mới nào muốn ghi DB ngoài endpoint lưu tường minh phải có lý do tương
tự, nêu rõ trong code (comment) và trong bảng này:

1. **`career-passport.service.ts` → `triggerOffboardingSummary()`** — ghi
   `updateMany` trực tiếp lên bản ghi employment. Lý do: bước "lưu tường
   minh" thật sự là endpoint `approveOffboardingSummary` phía sau —
   `triggerOffboardingSummary` chỉ lưu **đề xuất nháp** vào cùng bản ghi để
   admin xem lại trước khi approve, không phải dữ liệu cuối cùng.
2. **`profile-imports.service.ts` → `parse()` (legacy)** — ghi
   `ImportStatus.FAILED` lên chính job-tracking row khi parse lỗi. Lý do:
   đây là trạng thái theo dõi **tiến trình import** (có thành công hay
   không), không phải dữ liệu hồ sơ được đề xuất — khác hoàn toàn với việc
   ghi `skills`/`projects`/... vào hồ sơ user.

---

## 5. Template cho skill mới

```ts
import { AiChatService } from '../ai-chat/ai-chat.service';
import {
  asArray,
  asString,
  asStringArray,
  parseJsonReplyOrThrow,
} from '../ai-chat/ai-reply.utils';

private buildXPrompt(context: X): string {
  return `... LANGUAGE: Reply in the same language as ${context}...
Reply with ONLY a JSON object of this exact shape, no prose, no markdown code fences:
{ "field": "...", "items": [...] }`;
}

async doX(caller: AuthenticatedUser) {
  const context = await this.gatherContext(caller); // bước 1 — read-only
  const prompt = this.buildXPrompt(context);         // bước 2
  const { content } = await this.aiChat.send({ ... }); // bước 3
  return this.parseXReply(content);                  // bước 4 + 5, trả bước 6
}

private parseXReply(raw: string): XProposal {
  const parsed = parseJsonReplyOrThrow<Record<string, unknown>>(raw, 'X'); // bước 4
  const field = asString(parsed.field);              // bước 5
  if (!field) throw new BadGatewayException('AI provider returned an empty X');
  return {
    field,
    items: asArray(parsed.items).map((i: any) => ({ ... })),
    tags: asStringArray(parsed.tags),
  };                                                  // bước 6 — return, không ghi DB
}
```

Nếu skill cần fallback thay vì throw khi parse lỗi (như AI Assistant), chỉ
dùng `stripJsonFence(raw)` rồi tự `try/catch JSON.parse` — không dùng
`parseJsonReplyOrThrow` (nó luôn throw).

Nếu payload là markdown tự do thay vì JSON thuần (như `planMd`), dùng
`{ anchored: true }` để không nhầm dấu ``` nằm giữa nội dung là wrapper.
