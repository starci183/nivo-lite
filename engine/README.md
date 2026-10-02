# NIVO engine

Backend chạy trên VPS, làm những việc mà serverless (Netlify) không làm được: **công việc agent chạy lâu qua OpenClaw**, **tích hợp n8n** và **hàng đợi công việc bền vững**.

Ứng dụng Next.js (thư mục gốc của repo) vẫn là **mặt phẳng điều khiển**: giao diện, cổng thẩm quyền (authority gate), bằng chứng (evidence). Engine chỉ là **người làm việc**. Engine **không bao giờ** gửi tin tới khách (Telegram, website...): nó chỉ *đề xuất* câu trả lời, ứng dụng quyết định.

```
 Khách ──Telegram/Web──▶ Next.js (customer-turn.ts)
                              │ processor = 'openclaw'  ──▶  engine_jobs (Supabase, hàng đợi)
                              │                                   │ claim (for update skip locked)
                              │                                   ▼
                              │                          ┌────────────────┐   WebSocket 18789   ┌───────────┐
                              │ ◀── /api/engine/context ─┤  engine (Nest) ├────────────────────▶│ OpenClaw  │
                              │ ◀── /api/engine/callback ┤  worker + HTTP │◀── POST /tools/:name┤ (agent)   │
                              │ ◀── /api/engine/tool ────┤                │                     └───────────┘
                              ▼                          └────────────────┘
                  cổng thẩm quyền + evidence + gửi tin
```

## Chọn công nghệ và lý do

- **NestJS tối giản** (không GraphQL, không Keycloak). Chuẩn backend của StarCi (`starci-academy-backend/.claude/knowledge`: `coding-reference.yaml`, `architecture-rules.yaml`) quy định mọi dịch vụ dùng Next.js/NestJS và *không cho thay framework*, nên không dùng Node thuần dù nhỏ hơn.
- Áp dụng phần nhẹ của chuẩn: một nơi duy nhất đọc môi trường (`EnvSource`), mỗi năng lực có `*.config.ts` + options, module nhận options qua `register()`, cấu hình được kiểm tra **trước** khi mở cổng hay chạy worker, vòng lặp nền là một transport riêng (`platform/queue`), liveness và readiness tách nhau. Không dùng CQRS, saga, outbox vì chưa có ranh giới thật cần chúng (REF-SCOPE-2).
- **Hàng đợi nằm trong Postgres** (Supabase) chứ không thêm Redis/BullMQ: ứng dụng và pg_cron đều enqueue được bằng SQL, một nguồn sự thật, không thêm dịch vụ phải vận hành.

## Chạy tại máy

Cần: Node 22, Supabase local đang chạy (API 55321, DB 55322) và đã `npx supabase migration up`.

```bash
cd engine
npm install
npm run typecheck && npm run build
cp .env.example .env        # điền SUPABASE_SERVICE_ROLE_KEY, ENGINE_SHARED_SECRET (cùng giá trị với app)
node --env-file=.env dist/main.js
# kiểm tra
curl http://127.0.0.1:8787/healthz
```

Ứng dụng Next cần cùng `ENGINE_SHARED_SECRET` (xem `secrets.example.env` ở gốc repo). Khi chưa có secret hoặc chưa có worker nào báo nhịp tim, mọi module vẫn dùng bộ xử lý mặc định (NIVO gọi model trực tiếp).

### Chứng minh end-to-end (không cần OpenClaw thật)

```bash
node scripts/with-secrets.mjs npx next build      # ở gốc repo, một lần
cd engine && npm run build && node dev/e2e.mjs
```

`dev/e2e.mjs` tạo workspace tạm (xoá khi xong), chạy **OpenClaw giả** (`dev/mock-openclaw.mjs`, nói đúng handshake trong tài liệu giao thức, nghiêm ngặt về subscribe và scope), **model giả** (`dev/mock-model.mjs`), `next start` và worker, rồi kiểm tra: enqueue → claim → trả lời giả → callback → cổng thẩm quyền; cầu nối công cụ và cách ly tenant; fallback khi gateway im lặng và khi gateway chết; `connection.health`; claim đồng thời. Secret đọc từ cùng file `~/.nivo-lite/secrets.env` của app và không bao giờ in ra.

## Các loại job

| kind | payload | việc làm |
| --- | --- | --- |
| `chat.turn` | `conversation_id, message_id, event_id, agent_id` | Lấy ngữ cảnh từ app, chạy một lượt khách qua OpenClaw, gửi **câu trả lời đề xuất** về app. Lỗi/timeout/gateway chết: báo app trả lời bằng model trực tiếp, job được đánh dấu `path=direct_fallback`. |
| `connection.health` | `silentAfterHours?` | Đánh dấu kết nối đang lỗi (`error`) hoặc im lặng quá lâu (mặc định 72 giờ) vào `connections.public_meta.health`. Không đổi `status`. pg_cron enqueue mỗi 15 phút. Có `TODO(office)` để đăng thông báo vào Office. |
| `openclaw.sync_agent` | `installation_id` | Dựng lại **bản sao OpenClaw** của một agent từ Supabase (nguồn gốc): `AGENTS.md`, `SOUL.md`, `knowledge/*.md` trong workspace `workspace-<agentId>`, đăng ký trong `openclaw.json` (`agents.list`), ghi trạng thái vào `openclaw_agent_sync`. Xem mục bên dưới. |
| `n8n.emit` | `event, data, urls?` | POST sự kiện NIVO có chữ ký HMAC tới webhook của workspace (hoặc `N8N_DEFAULT_WEBHOOK_URL`). Header: `x-nivo-event`, `x-nivo-delivery` (= id job, để bên nhận chống trùng), `x-nivo-timestamp`, `x-nivo-signature`. Chặn SSRF: đích phải phân giải ra địa chỉ công khai, trừ host trong `N8N_ALLOWED_HOSTS`. |

Thêm job mới: viết một class `implements JobHandler` (`kind` + `run(job, signal)`), đưa vào `JOB_HANDLERS` ở `app.module.ts`. Handler phải chạy lại an toàn (lease có thể hết hạn giữa chừng).

### Vòng đời job (migration `engine_jobs`)

`queued → running → done | failed | cancelled`. `engine_claim_jobs` dùng `for update skip locked`, mỗi lần claim tăng `attempts` và cấp lease. Worker gia hạn lease mỗi 1/3 thời gian lease; mất lease thì dừng việc. Lỗi: `engine_fail_job` retry với backoff 5s, 10s, 20s... (tối đa 15 phút) đến `max_attempts` rồi `failed`. Tắt máy êm: ngừng claim, chờ job đang chạy tối đa `ENGINE_SHUTDOWN_GRACE_MS`, trả lại phần còn lại (`engine_release_job`, không tính lượt thử).

## Bản sao OpenClaw của agent (`openclaw.sync_agent`)

Supabase là nguồn gốc; OpenClaw chỉ giữ một bản sao, ghi **một chiều**. Job lấy bộ tệp từ app (`POST /api/engine/sync-bundle`, app lọc quyền xem: module chatbot chỉ nhận tri thức `public`), tính hash, rồi ghi từng tệp bằng temp + rename vào `/openclaw-state/workspace-<agentId>` và đăng ký agent trong `openclaw.json` (`agents.list[]` = `{ id, name, workspace, tools: {profile: "minimal"}, skills: [] }`, đúng schema OpenClaw 2026.7.1). Gateway theo dõi tệp cấu hình và nạp lại `agents.*` khi chạy (hybrid hot reload), nên không cần khởi động lại gì. Hash, tệp trên đĩa và đăng ký đều khớp thì chỉ cập nhật `checked_at`. Agent khách hàng chạy với profile công cụ `minimal` (không shell, không đọc tệp, không web).

Kích hoạt: app (áp dụng setup, duyệt ghi chú Office, thêm/sửa/xoá/lập chỉ mục lại tri thức, đổi bộ xử lý sang OpenClaw, nút "Đồng bộ lại"), pg_cron mỗi 5 phút cho mọi installation có `processor = 'openclaw'`, và engine lúc khởi động (VPS mới tự dựng lại từ Supabase). Job trùng được gộp trong SQL (`engine_enqueue_agent_sync`). `chat.turn` thấy agent chưa có bản sao thì đồng bộ ngay trong lượt đó; khi bản sao khớp phiên bản ngữ cảnh đang dùng, mỗi lượt chỉ gửi dữ liệu động (quyền hạn hiện tại, các đoạn tri thức liên quan tới câu hỏi, hội thoại).

## OpenClaw là AI viết chữ duy nhất, và đường lui không có AI

Không còn gọi model trực tiếp ở đâu trong app (`src/lib/deepseek.ts` chỉ còn dựng prompt; `completeRaw` ném lỗi). Embedding tri thức vẫn dùng API embedding riêng vì không phải sinh chữ.

- **Khách chat** (`chat.turn`): OpenClaw lỗi, quá thời gian chờ (cài đặt từng installation `openclawTimeoutSec`, mặc định 25 giây) hoặc engine chết (bộ quét `/api/engine/sweep` do pg_cron + pg_net gọi mỗi phút; job xếp hàng quá 30 giây hoặc chạy quá hạn bị huỷ nguyên tử) thì **không có chữ AI nào**: khách nhận tin nhắn giữ chỗ cố định của chủ (mặc định "Dạ em đã nhận tin, nhân viên sẽ phản hồi anh/chị sớm ạ", sửa trong cài đặt module, tối đa một lần mỗi giờ mỗi hội thoại) và một việc chuyển giao hiện ở Office, bằng chứng `fallback: openclaw_unavailable`.
- **Mọi chữ khác** (chat thiết lập, chat chủ, Office, phân loại lead, bản nháp tự động): job `openclaw.generate { generation_id }`. App ghi hàng `ai_generations`, xếp job, thăm dò hàng đến khi engine gọi lại `generate.result` (HMAC). Chạy một lượt một lần trên agent "nivo" riêng của workspace (không persona, không công cụ). Kết quả cho job đã huỷ bị bỏ. Hết hạn mức hoặc OpenClaw bận thì giao diện hiện "NIVO đang bận, thử lại sau ít phút".
- **Watchdog** (`deploy/watchdog.sh`, cron mỗi phút do CI cài): engine ở chung network namespace với openclaw nên khi openclaw khởi động lại, engine mất mạng; watchdog tạo lại *chỉ* dịch vụ engine.
- **Chi phí và tốc độ**: model `openrouter/deepseek/deepseek-v4-flash` được tắt reasoning qua `params.extra_body`; DeepSeek tự cache tiền tố lặp lại (usage có `cached_tokens`, ghi vào `ai_generations.usage` và việc đo dùng AI).

## Chat.turn: mỗi quyết định thiết kế

- **Ngữ cảnh do app dựng**, engine gọi `POST /api/engine/context` thay vì chép logic `buildAgentContext` sang engine. Lý do: lọc *chỉ tri thức công khai* cho khách, quyền hạn chủ doanh nghiệp (`authorityBrief`) và phiên bản ngữ cảnh đã duyệt là ranh giới bảo mật; hai bản sao sẽ lệch nhau. Đổi lại mỗi lượt có thêm một request nội bộ.
- **Một agent OpenClaw cho mỗi workspace + module**: `ws-<8 ký tự đầu workspace id>-chatbot`. `sessionKey = agent:<agentId>:<conversation id>`. Mỗi lượt gửi cả ngữ cảnh lẫn bản ghi hội thoại (session có thể mới, hoặc đã được bộ xử lý kia trả lời).
- **Engine chỉ đề xuất.** Câu trả lời là JSON theo cùng hợp đồng với `customerChat` (reply, lead, needs_human, order, payment_claim). App đọc nó bằng `readProposedReply`, rồi đi qua *đúng* đường đã có (`applyCustomerOut`): cổng thẩm quyền, evidence, gửi kênh. Trả lời không phải JSON thì **không bao giờ** gửi nguyên văn cho khách: nó trở thành đề xuất chờ chủ duyệt, khách nhận câu giữ chỗ cố định.
- **Idempotent**: callback ghi `channel_receipts('engine', 'chat.turn:<job>')` nên gọi lại không tạo hai câu trả lời. Hội thoại đã được người tiếp quản thì không có trả lời AI.
- **Fallback**: app chỉ enqueue khi có nhịp tim worker trong 90 giây; engine không chạy thì khách được trả lời ngay như cũ. Lượt đã vào hàng đợi mà OpenClaw lỗi thì engine gọi `chat.fallback` và app tự trả lời.

### Giao thức OpenClaw và vì sao engine dùng chung network namespace

Gateway là WebSocket thô cổng 18789 (không phải Socket.IO). Trình tự: gateway nói trước `connect.challenge` → client gửi `connect` (credential nằm **trong frame đầu**, `client.id/mode = cli/cli`, `scopes`) → `sessions.subscribe` → `sessions.messages.subscribe` → `sessions.send` → nhận `session.message`. **Bẫy**: không subscribe thì kết nối vẫn khoẻ, nhịp tim vẫn tới, nhưng không bao giờ có câu trả lời. Một lượt chạy có hai pha (ack `accepted`, rồi đầu ra streaming), nên ack không bao giờ được coi là câu trả lời.

Gateway chỉ giữ nguyên `scopes` mà client khai báo khi client là **loopback** dùng secret chung; từ địa chỉ khác scope bị xoá thành `[]` và `sessions.send` bị từ chối. Vì thế `deploy/docker-compose.yml` cho engine `network_mode: service:openclaw`. Nếu sau này tách máy: dùng device pairing (token thiết bị có `operator.write`).

### Cầu nối công cụ (`/tools/:name`)

OpenClaw gọi engine bằng HTTP nội bộ với bearer token **ngắn hạn, gắn một job**: token ghi id job, hết hạn cùng lượt, bị thu hồi khi job kết thúc, tối đa 25 lần gọi. Engine không gửi workspace id đi đâu cả: app tìm job (phải đang `running`) và lấy workspace/hội thoại từ chính dòng job, không tin id trong body. Công cụ: `knowledge.search` (chỉ tri thức công khai), `lead.create_or_update` (qua cổng, hội thoại đã có lead thì không ghi đè), `approval.request` (tạo mục chờ chủ duyệt), `handoff.to_person` (AI im lặng từ lúc đó). Mỗi lần gọi ghi evidence `engine.tool.<tên>`. Caddy **không** công khai `/tools`.

## Bảo mật

- `ENGINE_SHARED_SECRET` (32+ ký tự) ký HMAC-SHA256 `<timestamp>.<body>` cho mọi lời gọi engine → app (lệch quá 5 phút bị từ chối). Khoá token công cụ và khoá ký n8n được *dẫn xuất* từ nó, khoá n8n riêng cho từng workspace.
- Engine dùng service-role key của Supabase: chỉ đặt trên VPS, không vào image, không vào log. Lỗi cấu hình chỉ nêu tên biến, không nêu giá trị.
- `/healthz` (liveness, chỉ phụ thuộc tiến trình) và `/readyz` (lần poll hàng đợi gần nhất chạm được DB) là hai thứ khác nhau.

## Chưa xác minh với OpenClaw thật (làm ở lần deploy đầu)

1. Lệnh khởi động và biến môi trường của image OpenClaw bạn ghim (`OPENCLAW_GATEWAY_TOKEN` được nivo-backend dùng; kiểm tra bằng `docker run --rm <image> --help`).
2. ~~Schema mục agent~~ đã xác minh: `agents.list[]` (xem trên). Model đi qua OpenRouter: `OPENCLAW_MODEL=openrouter/deepseek/deepseek-v4-flash` với `OPENROUTER_API_KEY`.
3. Cách OpenClaw gọi công cụ HTTP: engine đặt hướng dẫn và token vào đầu mỗi lượt để agent gọi bằng công cụ HTTP/exec của nó. Nếu bản bạn dùng hỗ trợ MCP, bọc `/tools` thành một MCP server là bước tiếp theo.
4. Tắt máy êm (SIGTERM) chưa được thử trên Windows dev; trên Docker/Linux `docker stop` gửi SIGTERM thẳng tới node.
