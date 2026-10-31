# Agent work core: design and worker briefs

How a NIVO agent works around the clock while costing nothing when idle. An agent is data. Events and schedules wake it, a
stateless worker runs one turn, and the result lands in Postgres. Paths are from the repository root. [nivo-mcp.md](nivo-mcp.md)
owns the tool door and [jobs.md](jobs.md) owns the queue; this page adds to them and never restates them.

## 1. The system on one page

```
customer webhook ─ ConversationsService.hear ─┐
Office @agent ──── OfficeTagService ──────────┤
internal event ─── reactor agent-wakes ───────┤  one tx: agent_wakes row + job_outbox row
due task ───────── sweep tick ────────────────┤  (unique per agent, source, event)
schedule ───────── BullMQ job scheduler ──────┘
                   (agent_schedule_fire queue)      │ relay
                                                    v
                              BullMQ queue agent_turn, job agent-turn.drain { workspaceId, agentId }
                                                    │
                       stateless worker: FencedProcessor, then AgentDrainService.drain(agentId)
                                                    │
         ┌──────────────────────────────────────────┴──────────────────────────────┐
         │ 1. agent_turn_begin: kill switch, lease, fence + 1, best pending wake   │ Postgres
         │ 2. gates by code: installation, quota, breaker, cap, probe              │
         │ 3. AgentTurnRunner.run ──> OpenClaw: model loop, tool calls ── proposal │ no transaction open
         │      tool calls ──> nivo_call plugin ──> /agent-tools ──> MCP gateway   │
         │ 4. agent_turn_propose: proposal stored under the fence                  │ Postgres
         │ 5. handler settles: gate, approval, delivery, audit (idempotent)        │
         │ 6. agent_turn_finish: lease released, more pending wakes answered       │ Postgres
         └──────────────────────────────────────────┬──────────────────────────────┘
                                 more wakes? enqueue the next drain, then exit
```

The backend owns triggers, schedule, state, rights, approval, quota, audit and delivery. OpenClaw runs one turn and returns a
proposal. A worker holds nothing between turns: a lost worker or a deploy resumes from `agent_wakes`, `agent_turns`,
`agent_goals` and `agent_tasks`.

## 2. What the code says

Checked against main at `3802d06be` and lanes `lane/mcp-w1` to `w5` on 2026-10-31. `lane/index-sse` has no commit ahead of main.
OpenClaw facts were read from tag `v2026.7.1`, the version pinned in `.starcistacks/application-stacks.yaml`. Nothing here was run against
a live gateway: no production state was read.

| Assumed                                         | Found                                                                                                                                                                                                                                                                                                       | Consequence                                                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OpenClaw has no background runs                 | Cron: `src/gateway/server-cron.ts` runs unless `OPENCLAW_SKIP_CRON=1` or `cron.enabled: false`, and `openclaw-init.mjs` sets neither. Heartbeat: default `30m`, no block in config, so the default agent `main` is scheduled (`resolveHeartbeatAgents`); a missing `HEARTBEAT.md` still runs                | Both are switched off in `openclaw-init.mjs` (section 6.4). Heartbeat may be spending a model call every 30 minutes today                                    |
| An agent could create a cron job                | The `cron` tool is in the `coding` profile; `AgentRegistryService.wanted` sets `minimal`, which holds `session_status` only                                                                                                                                                                                 | No customer agent can schedule itself. Jobs a person added to the volume would stay, so the off switch is still needed                                       |
| OpenClaw can call NIVO tools today              | `wanted` gives `minimal` and no skills, and `register` overwrites `tools`. That profile has no `exec`, no `web_fetch` and hides `bundle-mcp`. The `[OPTIONAL TOOLS]` block tells the model to `POST` a URL it has no tool to reach                                                                          | By reading, no OpenClaw turn can reach `/agent-tools`, so section 6.3 builds the path. It is also why the token leaves the prompt                            |
| Schedules can be BullMQ job schedulers directly | A scheduler job's id is `repeat:<id>:<ms>`, while `BullmqQueueDeliveryClient.run` passes `job.id` to `job_start(text, uuid, ...)` and every delivery needs an outbox row                                                                                                                                    | A schedule fires on its own queue, past admission, and only writes a wake (section 5.1)                                                                      |
| Recurring work may be a BullMQ scheduler        | BE-QUEUES-3 and R335 (`contexts/code/be/queues.md`, `contexts/hfs/rules.yaml`) say a lite recurring task is a tick and the app's scheduler list stays empty. Ruling `app-owned-schedules` allows a queue job scheduler. R268 passes a forwarded call in `modules/platform/` with non-literal id and cadence | Per-agent schedules are data, not deployment work. `API_SCHEDULERS` stays empty. The owner's direction needs its ruling written into BE-QUEUES-3 by a Kernel |
| A tag reaches an agent                          | `useOfficeSend` calls `proposeOfficeCommand` from the browser, for owners and managers only. `propose` answers `chat` for no mention, an agent that accepts nothing, or a question, and nothing on either side answers a `chat`                                                                             | Section 7 moves the decision to the server                                                                                                                   |
| Thread tags run a turn                          | `ThreadWorkService.post` only resumes work that waited on that member. A mention records a chain step; `start` needs a named action                                                                                                                                                                         | Thread tags take the same wake source (section 7.3)                                                                                                          |
| Delayed outbox jobs exist                       | `job_enqueue` has no delay                                                                                                                                                                                                                                                                                  | Retry waits live in `agent_wakes.not_before`, and the sweep picks them up                                                                                    |
| The fence lease covers a long turn              | `JobClaims` has no renewal, so the 60 s `JOBS_LEASE` lapses. The outbox run lease is renewed by `BullmqQueueDeliveryClient.touch`, so a live delivery is not redelivered                                                                                                                                    | The per-agent lease is renewed by its own heartbeat. The job fence stays the crash fence only                                                                |
| Concurrency is free                             | `QUEUE_WORKSPACE_CONCURRENCY` 2 applies to every job with a `workspaceId`. OpenClaw `agents.defaults.maxConcurrent` is 4 per gateway; one `nivo-api` replica                                                                                                                                                | Worker concurrency for `agent_turn` is 4. Two turns per workspace at once, shared with indexing                                                              |
| Setup chat is on this road                      | `SetupTurnService` and `run-setup-turn` call the model directly                                                                                                                                                                                                                                             | It stays outside, as ruled. So does `GenerationRunnerService`, a stateless model run on the internal agent                                                   |

A session or workspace file loses nothing: `turnMessageOf` sends the authoritative context and the transcript in every message,
and `AgentSyncService` rebuilds the workspace. `GatewayClient.created` is a per-process cache that tolerates an existing session.

## 3. Data model

One capability owns the tables, `be/src/modules/domain/agent-work` (BE-PERSISTENCE-3, -9). It imports platform and
`modules/queues/agent-turn` only, so any domain capability can call it with no owner cycle (R27).

Migration `db/migrations/20261110000100_agent-work-core.sql`, expand only: new tables and functions, nothing existing altered,
so old code runs beside it. Every table has `workspace_id`, cascades with its workspace, follows the `app_be` policy shape of
`20261102003300_thread-work.sql`, and its entity extends `UuidAbstractEntity` (R342), except where a key is stated below.

| Table                 | Key                                            | Columns                                                                                                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent_work_settings` | `workspace_id`                                 | `work_enabled` bool default true, `road` (`legacy`, `core`) default `core`, `background_daily_cap` int default 200, `paused_by`, `paused_at`                                                                                                                                                |
| `agent_work_state`    | `agent_id`                                     | `work_enabled` bool default true, `paused_by`, `paused_at`, `fence` bigint default 0, `lease_owner`, `lease_until`, `running_turn_id`, `failures` int, `breaker_until`, `last_turn_at`, `background_day` date, `background_turns` int                                                         |
| `agent_goals`         | id                                             | `agent_id`, `title` (200), `detail` (2000), `status` (`active`, `paused`, `done`, `dropped`), `source` (`owner`, `module`, `agent`), `created_by_member`, `due_at`, `reviewed_at`                                                                                                             |
| `agent_tasks`         | id, unique (`agent_id`, `dedupe_key`)          | `agent_id`, `goal_id`, `title` (200), `detail` (2000), `status` (`open`, `waiting`, `done`, `dropped`), `waiting_on` (`approval`, `member`, `event`), `next_action_at`, `work_item_id`, `origin_wake_id`, `done_at`                                                                           |
| `agent_triggers`      | id                                             | `agent_id`, `kind` (`schedule`, `event`), `preset` (`every_15m`, `hourly`, `daily_at`, `weekdays_at`), `at_time` (time), `time_zone` default `Asia/Ho_Chi_Minh`, `event_name`, `probe_key`, `enabled`, `next_run_at`, `last_fired_at`, `reconciled_at`                                        |
| `agent_wakes`         | id, unique (`agent_id`, `source`, `event_key`) | `agent_id`, `source` (`customer`, `tag`, `internal`, `schedule`), `event_key`, `priority` smallint, `context` jsonb, `actor_member_id`, `status` (`pending`, `running`, `done`, `skipped`, `held`, `failed`, `dead`), `reason`, `attempts`, `not_before`, `started_at`, `finished_at`         |
| `agent_turns`         | id, unique (`wake_id`, `fence`)                | `agent_id`, `wake_id`, `fence`, `runner` text default `openclaw`, `runtime_agent_id`, `thread_key`, `status` (`running`, `proposed`, `settled`, `failed`, `abandoned`), `proposal` jsonb, `outcome` jsonb, `model`, `prompt_tokens`, `completion_tokens`, `cost`, `duration_ms`, `error_code` |

Indexes: `agent_wakes (agent_id, priority, created_at) WHERE status = 'pending'`, `agent_wakes (not_before) WHERE status = 'pending'`,
`agent_tasks (next_action_at) WHERE status = 'open'`, `agent_work_state (lease_until) WHERE running_turn_id IS NOT NULL`,
`agent_turns (runtime_agent_id, thread_key) WHERE status = 'running'`, `agent_triggers (next_run_at) WHERE enabled`.

`context` holds ids and flags only, the same rule as a queue payload (BE-QUEUES-1): `conversationId`, `messageId`, `channelEventId`,
`lookupName`, `room`, `threadId`, `authorUserId`, `locale`, `triggerId`, `slot`, `eventName`, `subjectId`, `taskId`, `probeKey`.

A goal or a task does not repeat `work_items`. A work item is one gated business action; a task is the agent's own to-do, and it
points at the item it opened through `work_item_id`. The existing `thread_work` table stays the record of work inside a thread.

SQL functions, `SECURITY DEFINER` with pinned `search_path` (BE-PERSISTENCE-19), called with `callDbFunction` (R334):

| Function                                                     | Does                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent_turn_begin(p_agent, p_owner, p_lease_s)`              | Upserts and locks the state row, answers `killed`, `busy` or `idle`, or bumps `fence`, sets the lease, picks the best pending wake, marks it `running` with `attempts + 1`, inserts or reuses the turn, and answers `begun`, with the stored proposal when the last attempt reached one |
| `agent_turn_touch(p_agent, p_fence, p_lease_s)`              | Extends the lease under the fence; false means the worker lost it                                                                                                                                                                                                                       |
| `agent_turn_propose(p_turn, p_agent, p_fence, p_proposal)`   | Stores the proposal under the fence; false stops the worker before any effect                                                                                                                                                                                                           |
| `agent_turn_finish(p_agent, p_fence, p_turn, p_status, ...)` | Under the fence: settles turn and wake, updates `failures` and `breaker_until`, clears the lease, answers `{ fenced, more }`                                                                                                                                                            |
| `agent_work_due(p_limit)`                                    | For the sweep: leases expired, wakes due, tasks due and triggers overdue, bounded                                                                                                                                                                                                       |

A second migration, `db/migrations/20261110000200_usage-kind-agent-work_contract_widen.sql`, adds `agent_work` to
`ai_usage_events_kind_check`. A third, `db/migrations/20261110000300_agent-wake-event-queues.sql`, creates the pgmq queues of section 4.5. The
contract migration that drops `road` comes after the last workspace moves (section 11), and no brief here writes it.

## 4. The wake road

### 4.1 One door

`AgentWakeService.wake(tx, wake)` runs in the caller's transaction (BE-PERSISTENCE-5) and is the only way a wake starts:

```ts
interface AgentWake {
  readonly workspaceId: string
  readonly agentId: string
  readonly source: "customer" | "tag" | "internal" | "schedule"
  /** Stable for one fact: the message id, `<triggerId>:<slot>`, `<eventName>:<dedupeKey>`, `task:<id>:<at>`. */
  readonly eventKey: string
  readonly context: AgentWakeContext
  readonly actorMemberId: string | null
}
```

It inserts through the entity with `orIgnore`, and only on a real insert calls `AgentTurnQueue.enqueueDrain` (BE-QUEUES-1): queue
`agent_turn`, job `agent-turn.drain`, payload `{ workspaceId, agentId }`.

### 4.2 Dedupe

Two layers. `agent_wakes (agent_id, source, event_key)` is the fact: a redelivered webhook or a replayed event writes nothing. The
outbox dedupe key is `agent-turn:<agentId>:<source>:<eventKey>`, the job. Follow-on jobs use `agent-turn:<agentId>:next:<turnId>` and
sweep jobs `agent-turn:<agentId>:sweep:<minute>`, each with its own key because a job never names a wake. `job_outbox` rows go after a day
(`system-history-retention`); the wake row keeps the fact for 30 days.

### 4.3 Ordering

BullMQ gives none (jobs.md), and none is needed: a job means "this agent has work", and Postgres chooses. `agent_turn_begin` takes
the lowest `priority`, then the oldest `created_at`, among pending wakes whose `not_before` has passed:

| Priority | Source     | Note                                                                          |
| -------- | ---------- | ----------------------------------------------------------------------------- |
| 10       | `customer` | A customer waits on a phone                                                   |
| 20       | `tag`      | A colleague waits in Office                                                   |
| 30       | `internal` | Money in, a new document, a due task                                          |
| 40       | `schedule` | Skipped as `stale` when older than its own period, so a backlog never replays |

Inside one conversation order is strict, since a later message is a later `created_at`.

### 4.4 Lock and fencing

The lease on `agent_work_state` is the lock: one running turn per agent across replicas. It is a row in Postgres, not Redis, so it
sits in the same store as the work and the fence.

- Lease 90 s, renewed every 30 s by `agent_turn_touch` while the turn runs.
- A busy agent answers `busy` and the job simply finishes, without a deferral and without spending a try. The holder picks the wake up.
- No lost wake: a wake commits before its job exists. If `begin` saw the lease held, the holder's `finish` runs after that commit and
  answers `more`; if `finish` is running, `begin` blocks on the row lock and then finds the lease free. The sweep is the backstop.
- `fence` rises on every begin. Every later write takes it, the same form as BE-JOBS-2. A stale worker that wakes after losing the
  lease gets false from `propose` or `fenced` from `finish` and stops, before any effect.
- The remote call carries `wake-<wakeId>:<fence>` as its idempotency key (BE-JOBS-3). A new holder is a new OpenClaw run. The price is at
  most one repeated model call; the fence means the effect still happens once.
- No transaction is held across the OpenClaw call (BE-PERSISTENCE-6).

The job's own `FencedProcessor` claim stays: it fences the delivery, and `agent_turn_begin` fences the agent.

### 4.5 Internal events

New reactor `be/src/features/reactors/agent-wakes`. Consumers on existing topics, each with a `<topic>__agent_wakes` pgmq queue and its dead queue:

| Fact           | Event                      | Who wakes                                                                  |
| -------------- | -------------------------- | -------------------------------------------------------------------------- |
| Money in       | `bank_credit_booked`       | Agents with an enabled `agent_triggers` row of `kind: event` for that name |
| A new document | `knowledge_source_indexed` | Same                                                                       |
| Paid           | `payment_reconciled`       | Same                                                                       |

`eventKey` is `<eventName>:<payload.dedupeKey>`, so a replay is one wake. An invoice being due is a fact about time, with no event: it is a
daily schedule with the probe `invoices_due`. An event trigger takes the same probe check as a schedule, so a credit with no work behind it
costs no model call. A new event needs its consumer here and a row, nothing else.

## 5. Scheduling

### 5.1 One scheduler per trigger

`agent_triggers` is the truth and Redis is a projection. `AgentTriggerSyncService` calls a new `QueueTransport.schedule`, which forwards
to `upsertJobScheduler` with id `agent-trigger:<triggerId>`, `{ pattern, tz }` and a template of attempts 3. Only `platform/queue` may
import BullMQ (R90), and that forwarding form is what R268 lets through.

A fire runs on queue `agent_schedule_fire`, on a new `QueueTransport.workFires` worker that skips `job_start`, because there is no outbox row and the
id is no uuid. Its handler reads the slot from `repeat:<id>:<ms>` and does one thing:

```
AgentTriggersService.fire(triggerId, slot): tx { read the trigger; wake(schedule, "<triggerId>:<slot>"); next_run_at, last_fired_at }
```

So the fire enters the one road, and the dedupe holds even when the sweep and Redis both name a slot.

The owner picks a preset, never free cron, so no parser is needed and nothing outside `platform/jobs` imports `cron` (R335).
`next_run_at` comes from the job `upsertJobScheduler` returns. Minimum period 15 minutes, at most 8 triggers per agent. The minute is
`hash(agentId) % 15` added to the owner's time, so a thousand 08:00 agents do not fire in one second. Installing or applying a module
seeds its triggers from a new optional `triggers` on the module definition.

### 5.2 Sweep

Tick `agent-work-sweep`, `*/1 * * * *`, in `JOB_TICKS` with its manifest entry (R335, R268), runs `agent_work_due` once and:

1. Enqueues a drain for an agent with an expired lease or a due pending wake; `begin` marks the abandoned turn.
2. Writes one `internal` wake for a task with `next_action_at` due, key `task:<id>:<at>`.
3. For a trigger more than 2 minutes overdue, or one with `reconciled_at` older than an hour, upserts the scheduler again and writes one wake for
   the latest missed slot only. Losing Redis costs at most one late run and never a replay.
4. Removes wakes and turns past retention: `skipped` at 2 days, others at 30.

### 5.3 Code first

A `schedule` or `event` wake reaches the model only when a probe says there is work. `AgentProbe` is a port with a registry, in `agent-schedules`:

```ts
interface AgentProbe {
  readonly key: string
  check(agent: AgentRef, context: AgentWakeContext): Promise<ProbeAnswer>
}
type ProbeAnswer =
  { readonly work: false } | { readonly work: true; readonly brief: string; readonly subjectIds: ReadonlyArray<string> }
```

First probes: `tasks_due` (open tasks and active goals past `reviewed_at`), `invoices_due`, `new_documents`, `money_in`. A probe only reads, with a
statement budget of 2 s. A failed probe skips the wake with reason `probe_failed` and spends no model call. `work: false` finishes the wake as
`skipped`, reason `no_work`. The `brief` goes into the turn's message as data, so the model starts from what was found. A due task is itself work, so a
wake with a `taskId` needs no probe.

The agent asks to be woken again through `tasks[].next_action_at` in its proposal, bounded to between 5 minutes and 7 days and counted against the
daily cap. It cannot add a trigger.

## 6. The turn contract

### 6.1 Port

`AgentTurnRunner` in `be/src/modules/domain/agent-turns` is the replaceable seam. `OpenClawTurnRunner`, its one implementation, wraps `GatewayClient.runTurn`.

```ts
interface AgentTurnRequest {
  readonly workspaceId: string
  readonly agentId: string
  readonly module: string
  readonly threadKey: string
  /** The whole authoritative context and the wake's text. */
  readonly message: string
  /** `wake-<wakeId>:<fence>`. */
  readonly runKey: string
  readonly timeoutMs: number
}
interface AgentTurnResult {
  readonly text: string
  readonly usage: RunUsage | null
  readonly runtimeAgentId: string
}
interface AgentTurnRunner {
  /** Runs one turn and returns what the model proposes; it changes nothing outside the runtime. */
  run(request: AgentTurnRequest, signal: AbortSignal): Promise<AgentTurnResult>
}
```

`AgentWorkHandler` is a per-source port: `prepare(turn)` builds the context, `settle(turn, proposal)` applies it through the gates, and `holdOver(turn, reason)`
answers when no turn can run. Customer, tag and background each implement it. `AgentDrainService` holds the order and no business.

Thread keys are `threadKeyFor(runtimeAgentId, x)`, with x the conversation id, `office:<room or main>`, `thread:<threadId>`, or `work` for schedule and internal wakes.

Time limits: `replyTimeoutSec` for a customer (default 25 s), 60 s for a tag, 120 s for background.

### 6.2 The proposal

Customer turns keep `ChatTurnProposal`, read by `readCustomerReply`. Tag and background turns answer a new internal contract, a catalog key
`bundle.internalContract`, validated by zod in `agent-turns`:

```ts
{ reply: string,                                  // max 2000; empty for a background turn with nothing to say
  tasks: [{ op: "add" | "done" | "wait", key, title?, nextActionAt? }],  // max 10; key becomes dedupe_key
  actions: [{ action, leadId?, fields, summary }],                       // max 3
  needsHuman: boolean, reason? }
```

An `action` is a request and never an effect: it goes to `WorkEngineService.runWork` with the agent as actor and dedupe key `agentturn:<wakeId>:<index>`, so the
authority gate decides. An unknown action, or one outside the agent's module, is dropped and audited. Text that fails the schema becomes a plain `reply`
with no tasks and no actions.

### 6.3 Tools

Nothing about tools moves out of OpenClaw's job: the model loop and tool calls stay there, and only the path changes. Today's bearer token in the prompt goes away, because
it has no tool to use it and a secret should not sit where a customer's words can reach it.

- `AgentRegistryService.wanted` becomes `tools: { profile: "minimal", alsoAllow: ["nivo_call"] }`. Still no shell, file or web tool.
- A small plugin, `.starcistacks/production/infra/swarm/openclaw/nivo-bridge/`, registers one tool, `nivo_call({ tool, args })`. Its factory takes `agentId` and `sessionKey` from
  OpenClaw's tool context, never from the model. It posts them to `OPENCLAW_BRIDGE_URL`, the private `agents` network address of the api, with the header `OPENCLAW_BRIDGE_SECRET`.
- The `/agent-tools` door gains that credential. `AgentTurnAccessService.resolve(runtimeAgentId, threadKey)` finds the `running` turn by the partial index and builds `ToolContext`
  from the turn: workspace, agent, conversation, wake. No running turn, no call. The one-turn lock makes this exact.
- A call then runs as today: `AgentToolsService`, `TurnGatewayToolsService`, `McpGatewayService.call`, so grants, approval, breaker and audit hold. A tag or background turn has
  `conversationId: null`, which lets the `internalOnly` tools of nivo-mcp.md section 5.1 appear.
- The prompt block lists tool names with no address and no token.

Rejected: `mcp.servers` with `alsoAllow: ["bundle-mcp"]`. Those servers are global to the gateway, so every tenant's agent would see every server, and an MCP call carries no session,
so the door could not tell one turn from another.

On the legacy road nothing changes, so a legacy turn stays toolless. A customer agent gains working tools when its workspace moves to `core`. Grants are default deny, so nothing opens by itself.

### 6.4 OpenClaw switched off

`openclaw-init.mjs` writes, on every start:

```js
config.cron = { ...(config.cron || {}), enabled: false }
config.agents.defaults.heartbeat = { ...(config.agents.defaults.heartbeat || {}), every: "0m" }
```

and the service sets `OPENCLAW_SKIP_CRON: "1"`. With a `defaults.heartbeat` block every agent resolves, and `0m` gives each no interval, so none is scheduled. `cron.triggers.enabled` is left at
its default false. After the deploy, the owner's operator step reads `openclaw status` for heartbeat disabled and `openclaw cron list` for jobs. That step reads the live volume, which this
design could not.

OpenClaw keeps the session, its transcript and the workspace files, all rebuildable. `session.maintenance` already prunes at 7 days.

## 7. Tagging

### 7.1 What an ordinary agent needs

| Need                          | Today                                                    | Change                                                                                                                                       |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| The tag is seen by the server | Browser calls `proposeOfficeCommand`, managers only      | `OfficeTagService.post` wakes in the post's transaction, for any member                                                                      |
| Find the agent                | `OfficeCommandService.mentionedAgent`, handles from text | Same parse, every distinct handle up to 3, active agents only                                                                                |
| Right to ask                  | `MANAGERS` for commands                                  | `AgentOwnershipService.canAssign(memberId, agentId)`, the rule threads use. Refused: one NIVO line, no wake                                  |
| Context                       | Customer prompt, public knowledge                        | Internal: `viewOf` with `audience: "internal"`, which still narrows a customer-facing module; room lines as transcript; open tasks and goals |
| An OpenClaw copy              | `CustomerTurnGatewayService.agentFor`                    | Reused, moved into `OpenClawTurnRunner`                                                                                                      |
| Contract                      | `bundle.replyContract`, customer shaped                  | `bundle.internalContract`                                                                                                                    |
| Say the reply as the agent    | `OfficeLinesService.post` resolves an agent from `dept`  | New `agent_id` on `OfficeLineInput` and the wake's `room`                                                                                    |
| Not ready                     | No answer                                                | No applied version: a line that says so, wake `skipped`, reason `not_applied`. `liveEnabled` is not needed: it governs channels              |

### 7.2 Office, end to end

1. A member sends "@ke-toan how much is due?". `PostOfficeMessageHandler` calls `OfficeTagService.post`: in one transaction `TeamChatService.postHuman`, then a `tag` wake per allowed
   agent, key `<messageId>`, context `{ messageId, room, authorUserId, locale }`.
2. Only `author_kind = 'human'` lines wake, so an agent's line can never start a loop. Agent to agent stays with `can_tag_agent_ids` and chain limits in threads.
3. The office shows the agent typing from `begin` to `finish`. `ChatTypingService.set` proves a member, so it gains `setAgent(workspaceId, target, agent, typing)` beside it, on the same realtime topic.
4. `OfficeTagHandler.prepare`, in the worker: when the author is an owner or manager and the agent `accepts` commands, it calls `OfficeCommandService.propose`, which is already
   idempotent per message. `card` or `reply` ends the wake as `done` with no OpenClaw turn. Only `chat` continues.
5. The internal turn runs (section 6). `settle` validates, runs the actions through the engine, records tasks, and posts `reply` as the agent, in the room, under key `<wakeId>`.
6. The client stops calling `proposeOfficeCommand`: `shouldPropose` goes, and the card arrives by the existing chat activity refresh. The mutation stays one release for older tabs.

### 7.3 Threads

`ThreadWorkService.post`, after `postAsUser`: for each `kind: "agent"` mention, `canAssign` was already proved. If a `waiting_member` row took the message, no wake. Otherwise a `tag` wake, context
`{ threadId, messageId }`. `settle` posts through `ThreadAgentPostsService.postAsAgent`, so tag rules and chain limits hold. Mentions stay the chosen list, never read from text.

## 8. Rights, approval, quota, audit, kill switch

| Source     | Audience                | Tools                                                       | Reply goes to                                     | Acts by                                                  |
| ---------- | ----------------------- | ----------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `customer` | `customer`, public only | Grants; `internalOnly` hidden                               | The channel, through `CustomerOutcomesService`    | The outcome gate, as today                               |
| `tag`      | `internal`              | Grants, with write scope only for owner and manager authors | The room or thread                                | Engine, with the member as actor                         |
| `internal` | `internal`              | Grants, read scope only                                     | Agent's owner by a line, only when `reply` is set | Engine, with the agent as actor. Writes are always `ask` |
| `schedule` | `internal`              | Same as `internal`                                          | Same                                              | Same                                                     |

A tag never widens what the agent holds, and a member gets nothing past their role. Background turns have no person behind them, so a write always stops for a person: nothing leaves on a schedule alone.
A background turn never speaks to a customer. To reach one it opens a work item, and the approval flow of `work_items` and `approval_requests` decides.

Words inside a wake are data. Message bodies, event text and probe briefs reach the prompt under a label that says so, as nivo-mcp.md section 7 does.

**Quota.** Before a turn, `UsageGateService.blockedBy(workspaceId, kind)`, the same allowance as today. Kind `chat_reply` for customers and the new `agent_work` otherwise, metered per turn with the module, and copied to the turn row.
`background_daily_cap` counts `internal` and `schedule` turns per agent per day; customer and tag turns are never capped by it. Over quota: customer gets the holding line, a tag gets a line, a background wake is `skipped`, reason `quota`.

**Audit.** `agent_wakes` says why it woke, `agent_turns` what ran and what it proposed, `mcp_call_log` each tool call, `events` and `work_items` each action. Proposals are stored in full under the turn's retention, the same class of text as `agent_messages`; they are never logged.

**Kill switch.** `agent_work_state.work_enabled` per agent and `agent_work_settings.work_enabled` per workspace, set by `setAgentWork` and `setWorkspaceAgentWork`, owner only.

- `begin` reads both in the same statement, so a switch takes effect at the next turn. A running turn may finish its model call, and its proposal is then refused: `finish` writes `held`.
- While killed, wakes stay `held`, never dropped. Turning it back on moves customer and tag wakes under 24 hours old back to `pending`. Older ones and background wakes become `skipped`.
- A killed agent's customer gets the holding line, exactly as `installation_not_running` does today.
- Killing also calls `AgentTriggerSyncService.unschedule`, so an off agent costs nothing.
- `agents.status = 'paused'` and installation `paused` stay as they are, and both stop a turn at the gate.

## 9. Failure, retry, poison, idle

| Failure               | What happens                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker dies mid-turn  | The lease lapses within 90 s; the sweep drives a drain within a minute; `begin` marks the old turn `abandoned` and retries the wake. With a stored proposal it skips the model   |
| Deploy                | Same. `QUEUE_SHUTDOWN_GRACE` 30 s covers a customer turn; a longer turn is retried. An interrupted attempt counts, within the budget below                                       |
| OpenClaw down or slow | Customer: `holdOver` at once, as today, wake `done`, no retry. Tag: a line and `failed`. Background: retried                                                                     |
| Retry budget          | 3 attempts for `tag`, `internal`, `schedule`, with `not_before` at 1, 5 and 15 minutes. Customer gets 2 attempts for crashes only                                                |
| Poison                | `attempts` rises in `begin`, before the model, so a wake that kills its worker still counts. Past budget it is `dead`, one line goes to the agent's owner, and the road moves on |
| Breaker               | 5 failed turns in a row set `breaker_until` to 15 minutes ahead. During it background wakes wait and customer wakes go straight to the holding line, with no model call          |
| Stale customer wake   | Older than 10 minutes at `begin`: `holdOver`, not an answer to a question from long ago                                                                                          |
| Redis lost            | The relay republishes `job_outbox`; the sweep upserts schedulers                                                                                                                 |
| Job dead-lettered     | `onFailed` does nothing to the wake. The wake is the truth, and the sweep finds it pending                                                                                       |
| Failed settle         | Retried from the stored proposal. Every effect is idempotent per wake: `storeReply`, `settle` per `channelEventId`, engine dedupe, office line key                               |

**Idle cost.** An agent with no trigger and no event: no process, no Redis key, no job, one row. An agent with an hourly trigger and nothing to do: per fire one Redis job, three short
transactions, one row each in `job_outbox`, `jobs` and `agent_wakes` (the last gone in 2 days), and zero model calls. A thousand such agents make about 24,000 jobs a day, 0.3 a second. The fixed cost is one
sweep per minute over partial indexes.

## 10. Observability and the web

Log events in `agent-work.log-events.ts`: `WakeWritten`, `TurnBegun`, `TurnBusy`, `ProbeSkipped`, `TurnFenced`, `WakeDead`, `BreakerOpened`, with ids only. Measures from the tables through
`AgentWorkReadService`: wake wait (`started_at - created_at`) per source, skip rate, turns and cost per agent per day. The existing job alerts cover the queues; a new alert kind fires on a pending customer wake older than 2 minutes.

GraphQL, in `be/src/features/api/agent-work`: `agentWork(installationId)` gives state, goals, open tasks, triggers, the next run and the last 20 turns. `workspaceAgentWork` gives the switch and counts. Mutations: `setAgentWork`, `setWorkspaceAgentWork`, `saveAgentGoal`, `saveAgentTrigger`, `removeAgentTrigger`, `closeAgentTask`, owner or manager except the two switches. The turn list carries no prompt and no customer words.

The web, as a new tab of the instance frame, `/agents/<type>/<id>/work`, Work:

| Region       | Shows                                                                                |
| ------------ | ------------------------------------------------------------------------------------ |
| Status band  | Working now, idle, paused, or breaker open; the next run in words; queue length      |
| Goals        | List with add and close                                                              |
| Open tasks   | What it is on, what it waits for, link to the work item                              |
| Schedule     | Triggers as sentences with presets; the switch per trigger                           |
| Recent turns | Why it woke, what it did (`no_work` rows collapsed into a count), tokens, cost, time |

The kill switch is in Settings per agent and on the agents list per workspace. The tab polls every 5 s while a turn runs and every 30 s otherwise. Office shows typing, and a line when a tag is refused or the agent is paused.

## 11. Moving what exists, with no flag day

**`chat_turn`.** `road` per workspace decides intake only.

1. W1 to W3 land with no caller: every workspace is `legacy`, and nothing changes.
2. W4 routes intake. `ConversationsService.hear` and `AgentChatService` call `wake` on `core` and `enqueueChatTurn` on `legacy`. `CustomerAgentWorkHandler` reuses `ChatTurnService` methods under the lease,
   so the takeover check, the holding line and `CustomerOutcomesService.settle` are one code path on both roads.
3. Production holds no workspace yet, so the column default is `core` from the first migration and every new workspace starts on the core road. `legacy` stays only as a per-workspace rollback (point 4); a database that already holds workspaces moves them by data first, watching wake wait and the holding rate, before it takes the default.
4. Rolling back is setting `road` back: pending wakes still drain, only new intake changes. Jobs in flight finish on the queue they are on, on either road.
5. Once every workspace is `core`: delete `kind: "turn"` from `ChatTurnQueue` and drop `road` in a `_contract_` migration. `kind: "deliver"` stays for good: it stores no turn and calls no model, and a human reply or a greeting must not wait on an agent's lease.

**Automation.** The engine is deterministic and stays on its minute tick (R335). `onBusinessEvent`, scans, `AutomationGateService` and `AutomationTextService`, which calls the model directly for wording, do not change.
One thing joins: a new executor `wake_agent`, so a pipeline hands a case to an agent by `wake(internal, "<runId>:<step>")` when it needs judgement.

**Global ticks.** `accounting_desk.morning`, `marketing_tick`, `content_tick` and hiring ticks keep running. Each becomes a seeded trigger with a probe when its module is ready, one module at a time, and its `JOB_TICKS` entry goes when the last workspace has moved. No brief here moves one; that keeps W4 reviewable.

**Hiring.** `HiringPublicService.chatBrief` stays a context block.

## 12. Test plan

Unit specs per file (BE-TEST-5, R273). The proofs that only a real store shows, in `be/src/tests/integration/agent-work/`, titled `agent-work/<scenario>` (BE-QUEUES-4, BE-JOBS-5):

| Scenario               | Proves                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `wake-atomic`          | A rolled-back caller leaves no wake and no job                                                                 |
| `wake-dedupe`          | The same event twice is one wake and one job                                                                   |
| `one-turn-per-agent`   | Two workers: one `begun`, one `busy`, and the wake is served                                                   |
| `no-lost-wake`         | A wake written during `finish` is served without the sweep                                                     |
| `priority`             | A customer wake passes a waiting schedule wake                                                                 |
| `zombie-fenced`        | A worker past its lease is refused by `propose` and `finish`; the new holder's effect happens once             |
| `crash-resume`         | A killed worker's wake retries; with a stored proposal the runner is not called                                |
| `poison`               | A wake failing past budget is `dead` and the next wake runs                                                    |
| `scheduler-fires-once` | A real scheduler on Redis writes one wake per slot, and a sweep of the same slot adds none                     |
| `scheduler-recovered`  | After Redis loses the scheduler, the sweep restores it and writes one wake for the latest slot                 |
| `no-work-no-model`     | A probe with no work: wake `skipped`, runner not called, no usage row                                          |
| `kill-switch`          | Killed: wakes `held`, no runner call. On again: customer and tag wakes return, schedule wakes skip             |
| `tag-to-reply`         | A member's line ends as the agent's line in the room, with one turn; a staff tag without the right gets a line |
| `agent-line-no-wake`   | An agent's line naming a handle writes no wake                                                                 |
| `bridge-needs-turn`    | `nivo_call` with no running turn is refused; with one, the context comes from the turn and not the arguments   |
| `road-legacy-core`     | The same customer message gives the same reply on both roads, with a scripted runner                           |

`GatewayClient` is scripted through `InjectOpenclawSocketFactory`, as its spec does; no spec calls a model. Process boot follows nivo-mcp.md section 4. The real gateway check, `nivo_call` on the pinned image with
heartbeat off, belongs to W3 and is reported blocked when Docker is down (rule 8).

## 13. Worker briefs

Five, in dependency order. W1 lands first. W2 and W3 then run in parallel. W4 and W5 then run in parallel, after W2 and W3 have landed: their paths do not overlap.

### 13.0 Common to all five

Read `D:/starci-tmp/tino/lanes/LANE-BRIEF.md`, then `D:/.claude/AGENTS.md`, `D:/.claude/contexts/README.md`, `D:/.claude/contexts/harness/rules.md`, then this page and the section your brief names. Look a
rule up, never remember it (rule 7): `node D:/.claude/cli/dist/main.js contexts search "<english question>" --also "<action>" --also "<artifact>" --scope code,hfs,stack --limit 10`; open the hit and cite it.

Start once `lane/mcp-w1` to `w5` have landed on main. W3 and W4 need their `GatewayCaller`, `internalOnly` and compose changes.

```sh
git -C D:/starci-lanes/nivo-lite worktree add -b work-<id> D:/starci-lanes/nivo-work-<id> main
cmd //c mklink //J 'D:\starci-lanes\nivo-work-<id>\node_modules' 'D:\starci-lanes\nivo-lite\node_modules'
```

Touch only your paths (rule 4); a defect outside them goes in your report. A shared file listed in your brief changes only in the hunks named. Commit on your branch with the hook on. Never: `eslint-disable`,
`ts-ignore`, `as` casts, `--no-verify`, gate edits, stash, `reset --hard`, a branch switch in another checkout, `npm install`, `deps source`, `git push`, deploy, a migration on a shared database, opening `*.env` or `*.enc*`
(LANE-BRIEF; rules 1, 2, 3). TS holds no raw SQL: CRUD through entities, anything else `callDbFunction` (R334). Duplicate code is extracted, never reordered to dodge the detector. Do not stage `.starcistacks/cache/`.

Every public method covers its branches and its dependencies' answers (BE-TEST-5), every logic file full coverage (R273), and no owner import cycle exists, type-only imports included (R27). Done for a back-end brief means: the listed specs pass;
`cd be && npx eslint -- <files>` clean; `npx --no-install tsc --noEmit -p be/tsconfig.json` and `npm run typecheck:tests` clean; `npx --no-install starci app check --wiring` shows 0 failures (R272); `npx --no-install starci app emit`
run when GraphQL changed; committed on the branch; report the sha. The lane owner lands it and removes the worktree, unlinking the junction first. A step needing Docker with Docker down is reported blocked, not skipped (rule 8).

### W1: the store

Id `store`. Sections 3 and 4.1 to 4.4, and 9 for the budgets. Depends on nothing here.

Paths: `db/migrations/20261110000100_agent-work-core.sql` (new), `be/src/modules/domain/agent-work/**` (new), `be/src/modules/queues/agent-turn/**` (new), `be/apps/api/src/compose/agent-work.ts` (new),
`be/apps/api/src/app.module.ts` (its one spread), `be/src/modules/platform/database/entities.ts` (one import, one spread), `be/src/tests/integration/agent-work/agent-work-store.integration-spec.ts` (new),
`be/src/tests/world/agent-work-capabilities.options.ts` (new).

Build: the seven tables and five functions; entities and `agentWorkEntities`; `AgentTurnQueue` with its dedupe builders; `AgentWakeService.wake`; `AgentLeaseService` over the functions; `AgentDrainService.drain(agentId)` with begin, heartbeat, handler
dispatch, propose, settle, finish and the follow-on job; the ports `AgentTurnExecutor` and `AgentWorkHandler` under an optional injection token, where an absent handler leaves the wake `held`, reason `no_handler`; `AgentGoalsService`, `AgentTasksService`, `AgentTriggersService`
(rows only), `AgentWorkSettingsService` for both switches and `road`; `AgentWorkReadService`; `agent-work.policy.ts` for priority, budgets and retry waits.

Specs: `agent-work.policy`: priority per source, wait per attempt, budget per source. `agent-wake.service`: a new wake enqueues; a repeat does not. `agent-drain.service`: `busy` and `idle` end quietly; `begun` runs handler then finish; a stored proposal skips the executor; a false `propose` stops before settle; `fenced` from finish stops; `more` enqueues;
heartbeat stops in every ending. `agent-work-settings.service`: staff refused, a manager refused for the switch, on again restores by age. `agent-tasks.service`: dedupe, the `next_action_at` bounds. Integration: `wake-atomic`, `wake-dedupe`, `one-turn-per-agent`, `no-lost-wake`, `priority`, `zombie-fenced`, `poison`, `kill-switch`, with a scripted handler.

Done: section 13.0. No road caller exists, so behaviour is unchanged.

### W2: the road

Id `road`. Sections 4.3, 5 and 9. Needs W1.

Paths: `be/src/modules/platform/queue/queue-transport.port.ts`, `be/src/modules/platform/queue/bullmq-queue-transport.client.ts` and spec, `be/src/modules/platform/queue/queue.port.ts`, `be/src/modules/platform/queue/queue.contracts.ts`, `be/src/modules/platform/queue/queue-worker.service.ts` and spec, `be/src/modules/platform/queue/index.ts`,
`be/src/modules/platform/jobs/job-ticks.contracts.ts` (one entry), `.starcistacks/application-stacks.yaml` (one `jobs:` entry), `be/src/modules/domain/agent-schedules/**` (new), `be/src/features/jobs/run-agent-turn/**` (new), `be/src/features/jobs/fire-agent-schedule/**` (new),
`be/src/features/jobs/sweep-agent-work/**` (new), `be/apps/api/src/compose/jobs.ts` (three lines), `be/src/modules/domain/modules/modules.catalog.contracts.ts` (optional `triggers`), `be/src/tests/integration/agent-work/agent-work-road.integration-spec.ts` (new).

Build: `QueueTransport.schedule`, `unschedule`, `scheduledIds` and `workFires`, with `upsertJobScheduler` called on variables so R268 reads a forward; `QueueScheduleRegistry`; `AgentTriggerSyncService` (presets to pattern, the hashed minute, seeding from a module's `triggers`); `AgentProbesService` with `tasks_due` first, and `invoices_due`, `new_documents`, `money_in` as read-only providers; `AgentWorkSweepService` over `agent_work_due`; the three jobs. `RunAgentTurnProcessor` has concurrency 4 and calls `AgentDrainService.drain`. `API_SCHEDULERS` stays empty.

Specs: transport: forwards pattern, tz and template; `workFires` never calls `job_start`. Sync: each preset; the minute is stable per agent; a disabled trigger unschedules; the 15-minute floor and 8-trigger cap. Sweep: each of the four duties, and a batch bound. Probes: each answer, failure skips, a `taskId` needs none. Fire: slot read from the id; a missing trigger unschedules. Integration on Redis: `scheduler-fires-once` (BE-QUEUES-4), `scheduler-recovered`, `no-work-no-model`, `crash-resume`.

Done: section 13.0, and `npx --no-install starci app check` shows R268 and R335 clean. Note that BE-QUEUES-3 needs its ruling in the report; do not edit it.

### W3: the turn

Id `turn`. Section 6. Needs W1. Runs beside W2.

Paths: `be/src/modules/domain/agent-turns/**` (new), `be/src/modules/integrations/openclaw/agent-registry.service.ts` and spec, `be/src/modules/integrations/openclaw/openclaw.contracts.ts`, `be/src/modules/domain/agent-tools/agent-tools.service.ts` and spec, `be/src/modules/domain/agent-tools/agent-tools.contracts.ts`, `be/src/modules/domain/agent-tools/agent-tools.port.ts`, `be/src/modules/domain/agent-tools/tool-bearer.policy.ts` and spec,
`be/src/features/api/agent-tools/**`, `be/src/modules/domain/ai-usage-events/ai-usage-events.contracts.ts`, `be/src/modules/domain/ai-usage-events/usage-kind.policy.ts` and spec, `be/src/modules/domain/ai-usage-events/quota.policy.ts` and spec, `db/migrations/20261110000200_usage-kind-agent-work_contract_widen.sql` (new),
`.starcistacks/production/infra/swarm/openclaw/openclaw-init.mjs`, `.starcistacks/production/infra/swarm/openclaw/nivo-bridge/**` (new), `.starcistacks/production/infra/swarm/stack.yaml` (the `nivo-openclaw` block and its configs), `.starcistacks/production/runtime/env/KEYS.md`, `be/apps/api/src/compose/agents.ts`, `be/apps/api/src/compose/agent-api.ts`,
`be/src/tests/integration/agent-work/agent-work-bridge.integration-spec.ts` (new).

Build: `AgentTurnRunner` and `OpenClawTurnRunner` (the `agentFor` logic moves in by extraction: `CustomerTurnGatewayService` then calls the shared function, a one-hunk edit you may make); `AgentTurnExecutor` implementation with the gates of section 8 for quota and breaker; `InternalTurnContextService`; `bundle.internalContract` in vi and en; the zod proposal schema and `InternalProposalSettler`; `AgentTurnAccessService`; the second credential on the tool door; `alsoAllow`; the plugin with manifest and `plugins.load.paths`; section 6.4 in `openclaw-init.mjs` and `OPENCLAW_SKIP_CRON`; `agent_work` in usage. Read `quota.policy.ts` and count it as `chat_reply` counts. `KEYS.md` names `OPENCLAW_BRIDGE_SECRET` and `OPENCLAW_BRIDGE_URL`; adding the secret is a deploy step for the owner.

Specs: runner: request mapping, signal, usage. Proposal: valid; bad JSON becomes a plain reply; over-long lists cut; an action outside the module dropped and audited. Settler: tasks written under dedupe; an action reaches `runWork` with its dedupe key; nothing runs on a stale fence. Access: no running turn refused; a foreign thread key refused; the wrong secret refused; arguments cannot set workspace or conversation. Registry: `wanted` holds `alsoAllow` and the minimal profile. `agent-turns/openclaw-lockdown.spec.ts`, reading `openclaw-init.mjs` as text: `cron` off and heartbeat `0m` are present. Integration: `bridge-needs-turn`.

Done: section 13.0, plus the real gateway check of section 12, or reported blocked. If the plugin cannot load on `2026.7.1`, stop and report; do not widen the tool profile.

### W4: customers and events on the road

Id `customer`. Sections 4.5 and 11. Needs W2 and W3.

Paths: `be/src/modules/domain/conversations/chat-turn.service.ts` and spec (extract only), `be/src/modules/domain/conversations/conversations.service.ts` and spec, `be/src/modules/domain/agent-chat/agent-chat.service.ts` and spec, `be/src/modules/domain/customer-turns/customer-work-handler.service.ts` and spec (new), `be/src/modules/domain/customer-turns/customer-turn-runtime.service.ts` and spec, `be/src/modules/domain/customer-turns/turn-tool-access.service.ts` and spec, `be/src/modules/domain/customer-turns/customer-turns.module.ts`, `be/src/modules/domain/customer-turns/messages/customer-turns.messages.ts`,
`be/src/features/reactors/agent-wakes/**` (new), `be/src/modules/platform/event-bus/event-bus.queue.ts`, `db/migrations/20261110000300_agent-wake-event-queues.sql` (new), `be/src/modules/domain/automations/automation-operations-executors.service.ts` and spec, `be/src/modules/domain/automation-templates/policies/template-definition.policy.ts` and spec, `be/apps/api/src/compose/reactors.ts`, `be/apps/api/src/compose/messaging.ts`,
`be/src/tests/integration/agent-work/agent-work-road-parity.integration-spec.ts` (new).

Build: `ChatTurnService` gains public `answer(payload, runtimeProposal)` pieces by extraction, so `run` on the legacy road reads the same and the handler shares it. Intake picks by `road`. `CustomerWorkHandler` covers the takeover check, the holding line, stale wake and kill. `CustomerTurnRuntimeService.propose` runs through `AgentTurnRunner` on `core`. The token block goes for `core` turns only. The reactor with its three consumers. The `wake_agent` executor. `kind: "deliver"` stays. The default of `road` is `core` (section 11, point 3).

Specs: intake on each road; repeat message is one wake; a held conversation writes no wake, as today; the handler's holding line at most once per hour; a stale wake holds over; each consumer wakes only agents with a trigger and repeats nothing; `wake_agent` keys on run and step. Integration: `road-legacy-core`.

Done: section 13.0, with migration applied by the integration world only. Report the data statement that moves one workspace; do not run it.

### W5: tags, API and web

Id `office`. Sections 7 and 10, and 8 for the switches. Needs W2 and W3. Runs beside W4. Read `D:/.claude/contexts/ui/README.md`, `D:/.claude/contexts/ui/components/pane-grid.md`, `D:/.claude/contexts/code/fe/README.md`, `be/docs/guides/agents-pages.md` and `D:/starci-tmp/tino/mockups/nivo-agents-mockup.html` first.

Paths: `be/src/modules/domain/office-command-candidates/office-tag.service.ts` and spec (new), `be/src/modules/domain/office-command-candidates/office-tag-handler.service.ts` and spec (new), `be/src/modules/domain/office-command-candidates/office-command-candidates.module.ts`, `be/src/modules/domain/office-command-candidates/index.ts`, `be/src/modules/domain/office-command-candidates/messages/office-command-candidates.messages.ts`, `be/src/modules/domain/messages/office-lines.service.ts` and spec, `be/src/modules/domain/messages/office-lines.contracts.ts`, `be/src/modules/domain/thread-work/thread-work.service.ts` and spec, `be/src/modules/domain/thread-work/thread-tag-handler.service.ts` and spec (new), `be/src/modules/domain/chat-typing/chat-typing.service.ts` and spec,
`be/src/features/api/office/application/post-office-message.handler.ts`, `be/src/features/api/agent-work/**` (new), `be/apps/api/src/compose/api.ts`, `be/contracts/api/schema.graphql` (emitted), `be/src/tests/integration/agent-work/agent-work-tag.integration-spec.ts` (new),
`fe/apps/web/src/hooks/office/useOfficeSend.ts`, `fe/apps/web/src/hooks/agentWork/**` (new), `fe/apps/web/src/hooks/swr/api/graphql/**`, `fe/apps/web/src/modules/api/graphql/**`, `fe/apps/web/src/modules/types/agentWork.ts` (new), `fe/apps/web/src/app/[locale]/(console)/agents/[module]/[installation]/work/**` (new), `fe/apps/web/src/features/pages/AgentWorkPage/**` (new), `fe/apps/web/src/components/blocks/AgentWork*/**` (new), `fe/apps/web/src/components/blocks/AgentInstanceFrame/**`, `fe/apps/web/src/features/pages/AgentSettingsPage/**`, and only your keys in `fe/apps/web/src/modules/i18n/messages/vi.json` and `en.json`.

Build: section 7 in full, with `OfficeTagHandler` calling `propose` before any turn; `ChatTypingService.setAgent`; `agent_id` on a line; the thread door; the GraphQL of section 10; the Work tab; the switches; `shouldPropose` removed from `useOfficeSend`, the mutation kept.

Specs: tag parsing: one, three, none, an unknown handle, a repeated handle; no right gives a line and no wake; an unapplied agent gets the line; a `card` or `reply` from `propose` ends with no turn; `chat` runs one; a reply posts once under a retry; a thread tag with `waiting_member` writes no wake; every GraphQL door refuses staff and a foreign workspace; a turn list holds no customer words. Integration: `tag-to-reply`, `agent-line-no-wake`.

Check, front end: no spec (SHARED-TEST-1). Lint and `cd fe/apps/web && npx tsc --noEmit -p tsconfig.json` clean; walk the Work tab in owner and manager role, phone and desktop, in empty, working, paused and breaker states; report what could not be walked.

Done: section 13.0, with the walk reported and the schema emitted.

## 14. Noticed, outside these briefs

- nivo-mcp.md sections 1 and 3 say OpenClaw reaches tools through the bridge. By reading, it cannot yet (section 2). W3 makes that true.
- `agentIdFor` keys on workspace and module, so `CustomerTurnGatewayService.agentFor` can answer the module's copy for a second instance of a multi-instance module. The prompt is authoritative each turn, so the persona holds, but the workspace files are the first instance's.
- A busy channel agent now answers one customer at a time, where the workspace limit allowed two. At the 25 s limit, the twentieth waiter could wait about 8 minutes. Wake wait per source is measured from day one (section 10), and `road` makes it reversible per workspace.
- BE-QUEUES-3 and BE-JOBS-6 need the owner's direction written in as a ruling. No gate refuses this design, but the text does.
