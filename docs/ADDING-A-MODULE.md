# Thêm một module vào NIVO

Module là dữ liệu, không phải mã cứng. Danh sách module, bước thiết lập (gates), quyền hạn (authority actions), tri thức nền và nhãn đều đọc từ một registry duy nhất: `resources/modules/<key>/module.json`. Chatbot, Sales, Accounting và 7 module mới (shifts, booking, video, inventory, loyalty, content, hiring) đều đi qua registry này.

Quy ước chung (không đổi): mọi thứ chung cho mọi ngành (spa chỉ là ví dụ); chữ AI duy nhất là OpenClaw (`generateWithOpenClaw` và job của engine); mọi việc gửi khách hay động tới tiền đều qua cổng quyền hạn (`work_items` / `decisions`); thông tin xác thực mã hóa trong `connection_secrets`; nội dung seed nằm trong `resources/`; giao diện theo tri thức `ui/*` và chữ tiếng Việt đơn giản.

## 1. Luồng dữ liệu

```
resources/modules/<key>/module.json ──► scripts/gen-module-registry.mjs ──► src/lib/module-registry.generated.ts (gitignored)
        │                                   (postinstall, predev, prebuild,            │
        │                                    pretypecheck, prestart)                   ├─ src/lib/module-registry.ts   (moduleDef, listModules, isModuleKey, pick...)
        │                                                                              └─ ModuleKey, ActionKey (union chuỗi)
        ├─► npm run seed:modules  ──► bảng public.modules + public.authority_actions
        └─► resources/nivo-knowledge/<key>/*.md ──► npm run seed:knowledge ──► public.nivo_knowledge
```

- File generated nằm ngoài git. Sau khi sửa `module.json`, chạy `npm run gen:modules` (hoặc `npm run typecheck`, `npm run dev`, `npm run build`: các lệnh này tự chạy generator). `npm ci` cũng chạy qua `postinstall`.
- Client và server dùng chung một hằng số, không đọc file lúc chạy (Netlify không có `resources/` khi chạy).
- Bảng `modules` và `authority_actions` có khóa ngoại từ `agents`, `module_installations`, `authority_rules`, `work_items`, `knowledge_sources`, `knowledge_chunks`, `automation_pipelines`. Module mới KHÔNG cần migration để có chỗ đứng: thêm `module.json` rồi chạy `npm run seed:modules` trên production (bước phát hành, làm sau `db push`, trước khi bật nút cài).

## 2. Một lane module tạo và sở hữu những gì

Mỗi lane chỉ chạm vào các đường dẫn dưới đây. Không sửa file của lane khác.

| Đường dẫn | Việc |
|---|---|
| `resources/modules/<key>/module.json` | Định nghĩa module (mục 3). Đã có sẵn cho 7 module mới; lane sửa cho đúng nghiệp vụ. |
| `resources/nivo-knowledge/<key>/*.md` | Tri thức nền của module: sổ tay (`playbook`), giới hạn quyền (`authority`), bảng thiết lập (`setup_checklist`), giọng điệu (`tone`), quy tắc chuyển người (`escalation`, tùy chọn). Tên file là slug duy nhất toàn cục, đặt `<key>-...`. Nạp bằng `npm run seed:knowledge`. |
| `src/features/module-<key>/**` | Toàn bộ giao diện và mã riêng của module: workbench, hành động server, truy vấn, từ điển `src/i18n/dict/<key>.ts` nếu cần. |
| `src/lib/module-<key>-*.ts` | Mã server riêng (truy vấn, logic). Dùng tiền tố `module-<key>-`. |
| `supabase/migrations/<dải>_<key>_*.sql` | Migration của bảng riêng module (mục 5). |
| `engine/src/features/<key>-*/**` | Job handler riêng nếu module cần chạy lâu trên engine (mục 6). |

Mỗi lane cũng được thêm ĐÚNG MỘT DÒNG vào mỗi file registry dùng chung bên dưới. Các file này được tách riêng để các lane không đụng nhau:

| File registry | Dòng cần thêm | Khi nào |
|---|---|---|
| `src/features/module-workbench/registry.ts` | `<workbenchKey>: Workbench<Key>,` | Khi có màn hình làm việc. Đặt `"workbench": "<workbenchKey>"` trong `module.json`. Chưa có thì bỏ qua: module hiện trạng thái "Đang hoàn thiện". |
| `src/features/module-settings/registry.ts` | `<extrasKey>: <Key>SettingsExtras,` | Khi module có thẻ cài đặt riêng. Đặt `"settings_extras": "<extrasKey>"`. |
| `src/lib/module-performers.ts` | `<action>: <performer>,` mỗi hành động một dòng | Khi hành động có tác dụng thật sau cổng quyền (mục 4). |
| `src/lib/engine-sync.ts` (`REPLY_CONTRACTS`) | `<key>: <hợp đồng trả lời>,` | Chỉ module hướng khách (`audience: "customer"`) cần hợp đồng trả lời riêng. |

Workbench là server component không nhận props, ví dụ `src/features/module-shifts/index.tsx` với `export default async function WorkbenchShifts() {...}`. Import nó vào `module-workbench/registry.ts` và thêm một dòng vào map `WORKBENCHES`.

## 3. `module.json`

```jsonc
{
  "key": "shifts",                    // ASCII ngắn, trùng tên thư mục
  "order": 40,                        // thứ tự hiển thị
  "name": { "vi": "Lịch & ca làm", "en": "Shifts and schedules" },
  "short_name": { "vi": "Lịch ca AI", "en": "Shifts AI" },   // tên phòng ban trong Quyền hạn, hoạt động
  "description": { "vi": "...", "en": "..." },               // một đoạn trên thẻ ở /m
  "points": { "vi": ["...", "...", "..."], "en": ["...", "...", "..."] },
  "purpose": "a shift-scheduling assistant that ...",        // tiếng Anh, một dòng, đưa vào prompt chat thiết lập
  "icon": "review",                   // tên trong IconName của src/ui (generator kiểm tra)
  "glyph": "M4 6h16v14H4z...",        // đường dẫn SVG cho avatar agent
  "mascot": "/images/promo/mascot-night.png",   // ảnh có sẵn trong public/
  "category": "operations",           // sales_customer | operations | finance | marketing | hr (xem _categories.json)
  "status": "early",                  // stable | early (early hiện huy hiệu "Sớm")
  "audience": "internal",             // customer: chỉ tri thức công khai tới OpenClaw; internal: cả hai
  "included_with_workspace": false,
  "available": true,
  "knowledge_folder": "shifts",       // thư mục dưới resources/nivo-knowledge
  "workbench": null,                  // khóa trong module-workbench/registry.ts, null = "Đang hoàn thiện"
  "settings_extras": null,            // khóa trong module-settings/registry.ts
  "requires": { "capabilities": ["staff_directory"], "connections": [] },   // mô tả điều kiện, hiển thị và kiểm tra sau
  "connection_providers": [],         // nhà cung cấp kết nối agent có thể dùng (telegram, zalo_oa, sepay...)
  "default_operating_mode": "assist", // assist | autopilot
  "agent": { "name": "Shifts Agent", "handle": "shifts", "summary": {...}, "capabilities": {...}, "role": {...}, "instructions": {...} },
  "gates": [ { "key": "...", "label_vi": "...", "label_en": "...", "hint_vi": "...", "hint_en": "..." } ],   // cùng dạng với MODULE_GATES cũ; mọi gate bắt buộc để áp dụng thiết lập
  "authority_actions": [
    { "action": "approve_swap", "label": { "vi": "...", "en": "..." }, "mode": "auto", "limit_vnd": null,
      "required_fields": [], "amount_limit": false, "max_mode": "ask" /* tùy chọn: không bao giờ tự làm */, "next": [] /* hành động nối tiếp */ }
  ]
}
```

Quy tắc kiểm tra của generator (lỗi thì build dừng): khóa trùng thư mục, `status`, `category`, `icon`, ảnh mascot tồn tại, thư mục tri thức tồn tại, gate không trùng khóa, khóa action phải duy nhất toàn bộ registry (`^[a-z][a-z0-9_]{2,40}$`).

Nhãn `dept_<key>`, `module_<key>`, `action_<action>` của từ điển i18n được sinh từ registry; không thêm tay vào `governance.ts` hay `knowledge.ts`.

## 4. Quyền hạn: mọi việc ra ngoài đi qua cổng

- Mỗi `authority_actions[]` là một hành động có thể được cấp quyền. Mặc định `mode`: `auto` (tự làm trong chính sách), `ask` (hỏi chủ), `never`. Chủ đổi ở trang Quyền hạn; module ở chế độ `assist` luôn hạ `auto` thành `ask`.
- `max_mode: "ask"` nghĩa là không bao giờ tự làm (đăng video, đăng bài): giao diện bỏ nút "Tự làm", cổng `evaluateGate` và `saveRuleCore` đều chặn.
- `amount_limit: true` bật ô hạn mức VND; `limit_vnd` là mức tự làm DƯỚI ngưỡng.
- Khi cài module, hệ thống tự thêm các rule mặc định còn thiếu của module vào `authority_rules` (không ghi đè lựa chọn của chủ).
- Để một hành động có tác dụng thật, gọi `runWork` (src/lib/engine.ts) với `action` của bạn và đăng ký performer trong `src/lib/module-performers.ts`: `prepare` (tối đa một lần gọi AI qua OpenClaw) và `perform` (chỉ chạy sau khi cổng cho phép hoặc người đã duyệt). Chưa có performer thì cổng vẫn quyết định, ghi `decisions` và việc chỉ ghi nhận quyết định, không làm gì thêm.
- Không gửi tin cho khách, không động tới tiền ngoài `perform`.

## 5. Migration

Mỗi lane có một dải số riêng để không trùng. Quy ước tên: `YYYYMMDDHHMMSS_<key>_<mô tả>.sql`, chỉ file mới, không sửa file cũ.

| Lane | Dải |
|---|---|
| registry (đã có) | `20261006100000` - `20261006199999` |
| shifts | `20261007100000` - `20261007199999` |
| booking | `20261008100000` - `20261008199999` |
| video | `20261009100000` - `20261009199999` |
| inventory | `20261010100000` - `20261010199999` |
| loyalty | `20261011100000` - `20261011199999` |
| content | `20261012100000` - `20261012199999` |
| hiring | `20261013100000` - `20261013199999` |

Bảng riêng của module bắt buộc có `workspace_id`, bật RLS (đọc: `is_member`, ghi: `is_manager` hoặc service role), tiền tố tên bảng là `<key>_`. Không thêm CHECK ghim khóa module hay hành động; khóa ngoại tới `modules(key)` nếu cần.

## 6. Engine

Việc nặng hoặc lâu (dựng video, quét hồ sơ) chạy bằng job của engine, kind đặt tiền tố module: `<key>.<việc>` (ví dụ `video.render`). Thêm handler dưới `engine/src/features/<key>-*/` và đăng ký trong `engine/src/app.module.ts` (một dòng). Đưa job vào hàng đợi qua `engine_enqueue` như `chat.turn`. Mọi kết quả quay lại qua route có chữ ký dưới `/api/engine/*` và đi qua cổng quyền hạn như mọi đầu vào khác; engine không bao giờ ghi thẳng vào kênh của khách.

Văn bản AI: chỉ dùng `generateWithOpenClaw` (src/lib/openclaw-generate.ts) hoặc job engine. `src/lib/deepseek.ts` không dùng cho chat.

## 7. OpenClaw

Đồng bộ agent (`openclaw.sync_agent`) chạy cho mọi module trong registry: `AGENTS.md` gồm quy tắc nền (thư mục tri thức của module và `core`), bản ngữ cảnh đã duyệt (gates đọc từ registry), persona, tri thức doanh nghiệp (lọc theo `audience`); `SOUL.md` lấy giọng điệu từ gate `tone` (nên có gate `tone`) và tri thức `tone`. Cài module xếp ngay một lượt đồng bộ; chat thiết lập chạy qua `openclaw.generate` với `purpose` của module.

## 8. Danh sách việc khi thêm hoặc hoàn thiện một module

1. Sửa `resources/modules/<key>/module.json`, chạy `npm run gen:modules`.
2. Viết tri thức nền trong `resources/nivo-knowledge/<key>/`, chạy `npm run seed:knowledge`.
3. Chạy `npm run seed:modules` để `modules` và `authority_actions` có khóa và hành động của bạn.
4. Mã giao diện trong `src/features/module-<key>/**` rồi thêm một dòng vào `module-workbench/registry.ts` (và `module-settings/registry.ts` nếu có).
5. Migration của bạn trong dải riêng; performer trong `module-performers.ts`.
6. `npm run typecheck` và `npm run build` phải qua. Không viết unit test.
7. Trước khi đẩy: `git fetch && git rebase origin/main`, đẩy `HEAD:main`, rồi `npx supabase db push --linked --yes` và `npm run seed:modules`.
