# Hub rooms + agent result cards: contract v1 (branch demo/hub)

How the Hub (`/chat`, OfficeMessenger) is split into department rooms and how agents post result cards into them.
Migration: `supabase/migrations/20261101000100_hub-rooms.sql`.

## 1. Rooms

Room keys (fixed set, `office_rooms.key`):

| key          | Room          | default `modules` (work_items.department routed here)                                  |
| ------------ | ------------- | -------------------------------------------------------------------------------------- |
| _(null)_     | Office        | the general room: shows **every** line of the workspace (old workspaces see only this) |
| `executive`  | Executive     | —                                                                                      |
| `frontdesk`  | Front desk    | —                                                                                      |
| `sales`      | Sales         | `sales`, `booking`                                                                     |
| `marketing`  | Marketing     | `content`, `video`                                                                     |
| `care`       | Customer care | `chatbot`                                                                              |
| `accounting` | Accounting    | `accounting`, `invoices`                                                               |

The stored display name of each room (`office_rooms.name`) is the Vietnamese name that `ensure_office_rooms` writes.

- A workspace gets the six department rooms with `select public.ensure_office_rooms('<workspace>')` (idempotent; seed/CLI calls it) or the GraphQL mutation `setupOfficeRooms` (owner/manager).
- Room membership: `office_rooms_members(room_id, agent_id | user_id, is_home)`. An agent's **home** room (`is_home = true`) receives its lines.
- `messages.room text NULL` (null = general Office). A line's room is decided by trigger `messages_route_room` when the writer leaves it null, in this order:
  1. the room of the Office message whose command candidate created the line's `work_item_id` (so "@AI Marketing ..." posted in Marketing answers in Marketing);
  2. the home room of the line's `agent_id`;
  3. the room whose `modules` contains the line's work item department;
  4. otherwise null (Office only).
     Writers may set `room` explicitly (see `OfficeCardsService.post`).

## 2. Result card message

A card is an ordinary `public.messages` row (`author_kind = 'agent'` normally) whose `card jsonb` column holds the payload below. `body` stays a plain-text one-liner (used for list previews, notifications, search; never empty).

### Payload (version 1)

```jsonc
{
  "v": 1, // required, always 1
  "type": "draft_post", // required, one of the 9 types below
  "title": "A weekend, fully at ease", // required, 1..160 chars
  "subtitle": "Spa offer -20% · Facebook Page + Zalo OA", // optional, <=240
  "badge": "Needs your approval", // optional short status word drawn top-right, <=40
  "body": "Leave the busy days behind...", // optional long text (caption, report text), <=4000
  "fields": [
    // optional, <=12 label/value rows (amounts already formatted)
    { "label": "Services total", "value": "6,400,000 VND" },
  ],
  "media": [
    // optional, <=6; https URLs or app-relative paths the web app can load
    { "kind": "image", "url": "https://.../h1.jpg", "caption": "Image 1 · 1200 x 800" },
    { "kind": "video", "url": "https://.../v.mp4", "caption": "15 seconds · 9:16" },
  ],
  "lines": [
    // optional, <=20 timed/bulleted lines (video script, schedule, report bullets)
    { "at": "00-05s", "text": "Scented candles, warm towels." },
  ],
  "link": { "label": "Open the video project", "href": "/modules/<agentId>/chat" }, // optional, app-relative or https
  "ref": { "kind": "execution", "id": "<uuid>" }, // optional: the decision the actions act on
  "actions": ["approve", "edit", "decline"], // optional; only allowed when "ref" is present
  "sources": [
    // optional, <=10: ONLY the sources this turn actually used (see 2b)
    { "layer": 1, "kind": "mcp_tool", "ref": "sepay.transactions.list", "label": "sepay.transactions.list" },
    {
      "layer": 2,
      "kind": "brain_document",
      "ref": "<knowledge source id>",
      "label": "Brand_Guideline.pdf",
      "href": "/brain",
    },
  ],
  "data": {}, // optional, opaque type-specific JSON (<=16 KB), not drawn by the Hub
}
```

Unknown top-level keys are rejected. Validation lives in `be/src/modules/domain/messages/office-card.policy.ts` (`parseOfficeCard`).

### 2b. Sources: the ONE shape every worker emits

`sources: Array<{ layer: 1 | 2 | 3 | 4, kind: string, ref: string, label: string, href?: string }>`, at most 10, listing only what the turn actually used (owner ruling data-layers.md):

| layer | meaning                            | typical `kind`                     | `ref`                                                               |
| ----- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| 1     | MCP connector live data            | `mcp_tool`                         | full tool name `<connector>.<tool>`, e.g. `sepay.transactions.list` |
| 2     | Second Brain (workspace knowledge) | `brain_document`, `brain_fact`     | knowledge source id / fact id                                       |
| 3     | Agent self-learning                | `brain_lesson`, `brain_extraction` | lesson id                                                           |
| 4     | NIVO base knowledge                | `base_document`                    | base document key, e.g. `tax-calendar-vn`                           |

`kind` <= 40 chars, `ref` <= 200, `label` <= 160 (what the reader sees), `href` https or app-relative. The Hub draws them under the card as "Source: <layer name>: <label> . ..." in the order given (put them in precedence order 1 > 2 > 3 > 4). The same array may be stored on the execution / work item so the approval card can show it.

### Types

| type                 | who emits                                                       | usual fields                                                                                      | actions                    |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------- |
| `draft_post`         | AI Marketing                                                    | title, subtitle, body (caption), media (images), lines (video script), ref                        | approve / edit / decline   |
| `video_ready`        | AI Editor                                                       | title, media (video), fields (length, ratio), link                                                | approve / decline (if ref) |
| `approval_request`   | any agent over authority                                        | title, fields (amounts), body (reason), ref                                                       | approve / decline          |
| `schedule_confirmed` | AI Marketing                                                    | title, fields (channel, time), link                                                               | —                          |
| `weekly_report`      | AI Marketing                                                    | title, fields (KPIs), lines (bullets), link                                                       | —                          |
| `daily_summary`      | AI Accounting                                                   | title, fields, lines                                                                              | —                          |
| `handoff_note`       | routing / AI CSKH                                               | title, body                                                                                       | —                          |
| `exception`          | any                                                             | title, body, fields, ref                                                                          | approve / decline          |
| `action_done`        | any agent, after a write-scope connector call it made in a turn | title (the tool's description), fields (tool, customer), sources (the tool, the turn's knowledge) | —                          |

### Actions and state (reuse of the existing approval flow; no new decision path)

- `ref.kind = "execution"`: approve/decline call the existing `decideExecution(executionId, decision, editedDraft)`; **edit** opens the draft (`card.body`, else the execution's draft) and approves the edited text.
- `ref.kind = "work_item"`: approve/decline call the existing `decideWorkItem(workItemId, decision, basis, edits)`; edit sends `edits.draft`.
- The card's live state is **derived on read**, never stored: `officeMessages` returns `card_state` = `pending` (execution `pending_approval` / work item `waiting_decision`), `approved` (execution `approved`), `done` (work item `done`), `declined` (`rejected`), `failed` (work item `failed`), `queued` (work item `queued`), or `info` (no ref, or the ref names nothing in the workspace). Buttons show only while `pending` and the viewer may decide.
- Pending cards of a room appear in the room's right panel (the "needs your approval" list).

### How to emit a card (back end)

```ts
import { OfficeCardsService } from "@modules/domain/messages"

await officeCards.post(
  { workspaceId },
  {
    room: null, // null = let the trigger route it (home room of the agent / origin room); or "marketing", ...
    agentId: agent.id, // the speaking agent (null = NIVO system line)
    authorName: agent.name, // shown as author
    body: "The content is ready", // one-line preview
    leadId: null,
    workItemId: item.id, // pass the work item: routes the reply to the room of the "@agent" command
    card: {
      v: 1,
      type: "draft_post",
      title: "...",
      ref: { kind: "execution", id },
      actions: ["approve", "edit", "decline"],
    },
  },
)
```

`OfficeCardsService` is exported by `MessagesModule` (registered and re-exported by `DecisionsModule`, so any module that can inject `OfficeLinesService` can inject it). `post` validates the payload (`OfficeCardsError` code `card_invalid` with the reason) and answers the stored message id. SQL-side writers may insert into `public.messages (..., room, card)` directly; the CHECK only enforces `card->>'type'` in the list and `card->>'v' = '1'`.

## 3. GraphQL additions (web console)

- `officeMessages(input: { before, limit, room })` – `room` optional: null/absent = all lines (Office), a key = that room only. `OfficeMessageType` gains `room: String`, `card_json: String` (the payload serialized) and `card_state: String`.
- `postOfficeMessage(input: { body, room })` – `room` optional.
- `officeRooms` → `[OfficeRoomType { key, name, position, unread, last_body, last_author, last_at, agent_ids, home_agent_ids, user_ids, pins { id title href note } }]`; the first entry is always the Office room (`key: null`), the department rooms follow (none until `setupOfficeRooms` / `ensure_office_rooms`).
- `markOfficeRoomRead(input: { room })` (room null = Office).
- `setupOfficeRooms` → creates the six rooms (owner/manager).

## 4. Seeding (for the seed / CLI worker)

- `select public.ensure_office_rooms('<ws>');` creates the six rooms and seats each active agent in the room whose `modules` contains its module (first match becomes its home room). Two chatbot agents (AI Sales & Booking, AI Customer care) both match `care` by module: move AI Sales to `sales` with
  `update office_rooms_members set room_id = (select id from office_rooms where workspace_id = '<ws>' and key = 'sales') where agent_id = '<sales agent>'`.
- People: `insert into office_rooms_members (room_id, user_id) ...` (a room without user rows shows the owners and managers).
- Pins: `insert into office_rooms_pins (room_id, title, href, note) ...` (href app-relative or https, e.g. the knowledge page).

## DEMO-NOTES (hub)

- Real: rooms, routing trigger, unread counts, card contract + validation, live card state, approve/decline/edit through the existing decision mutations, room panel (pending, members, channels, pins), workspace logo from the brand kit, agent presence badge.
- Shortcuts: room membership of people and pins are seeded by SQL (no editing screen yet); the presence badge means "the agent is active" (no heartbeat); unread counts poll every 4 s with the thread; the channel list of a room is derived from the agents bound to each connection; room setup for old workspaces is opt-in (`setupOfficeRooms`), so production workspaces keep the single Office room.
