# Engine on threads (LangGraph): runs, stops, deadlines, sweep, ledger, metering

How a workflow run executes on a LangGraph thread, and what stays NIVO's. Paths are under `be/src/modules/` unless they start
with `be/` or `packages/`. The design is `LANGGRAPH-20261110.md` (coordinator's lane folder; section 8 wins); the owner's rules are
the concept records in `.starciwork/concepts/` (`engine-on-langgraph`, `no-code-error-path`, `saga-forward-only`, `team-messages`,
`ai-call-failure`, `tokens-and-credits`). State of 2026-11-10 late night: built and specs green; front-desk ran live on threads
for three routes; nothing else on this page is proven live yet.

## 1. Which engine runs a run

- Every workflow runs on threads; no flag (phase 3). A NEW run row is `engine = langgraph` (the blocks-core entity default); `legacy`
  remains only on history rows, read as such by the run mapper. The old step kernel is being deleted (PHASE3-20261111.md); its
  indexes and `agent_step` jobs go with contract migration `db/migrations/20261112014100_langgraph-engine_contract_drop-old-kernel.sql`.
- Tracing guard: any LangSmith / LangChain tracing switch set (`LANGSMITH_TRACING`, `LANGCHAIN_TRACING_V2`, ...) fails the boot
  with `LANGGRAPH_TRACING_FORBIDDEN` (`integrations/langgraph/tracing-guard.policy.ts`). No customer data leaves for a tracer.

## 2. The walk

| piece | where |
|---|---|
| the one importer of `@langchain/langgraph`: `GraphThreads` port, client, `replayPortsOf` | `integrations/langgraph/` (`langgraph.port.ts` is frozen) |
| checkpoint saver (tables `agent_checkpoints`, `_writes`, `_blobs`, with `workspace_id`; fence; size limits) | `integrations/langgraph/persistence/` |
| template -> graph (one node per step, engine node `__freeze`) | `domain/agent-threads/template-compiler.policy.ts` |
| a run's thread: start, wake, `resume`, `redrive`, listeners `whenStopped` / `whenSettled` | `domain/agent-threads/thread-runs.service.ts` |
| the node function: bind, grant, `host.run`, trouble -> AI core -> stop | `domain/agent-threads/thread-step.service.ts` |
| projection of the thread onto `agent.run` / `agent.run-step` (run page, dashboards) | `domain/agent-threads/thread-projection.service.ts` |

- LangGraph has no lock and no worker: the wake intake, the lease and the drain stay NIVO's (`domain/agent-work/`). Thread wakes
  use the engine source `thread` (`agent-work/agent-wake-source.policy.ts`: priority 15, 3 tries, not background, restores held).
- A node runs again from its first line on a re-drive. Every model call and tool call of a step is a recorded task replayed by
  CONTENT (digest of the request, `integrations/langgraph/asked-digest.policy.ts`); a call whose words changed asks the model again.
- A run resumes only on the graph version it started on (`thread-graphs.service.ts`); a refused version closes its open stops.

## 3. Stops

A step that cannot complete writes `state.trouble` and goes to `__freeze`, which calls `interrupt(question)`.

- One record per run + step: entity `agent.run-stop` (`packages/blocks-core/src/shared/entities/agent/run-stop.entity.ts`), kinds
  `ai_report` (the AI core reported), `ai_error` (3 tries failed; engine-written), `approval` (an `ask` ability), `engine` (only a
  person can decide: checkpoint or output too large). Services: `domain/agent-threads/stops/` (`run-stops.service.ts`,
  `run-stop-records.service.ts`, `stop-gate.policy.ts`).
- The way back is `ThreadRunsService.resume(ref, decision)`, decision `answer {text}` | `retry` | `take_over` | `skip` | `timeout`.
  `answer` and `retry` re-run the stopped step with the words in `turn.founderAnswers`; `skip` ends the run and keeps every effect;
  `take_over` also sets the conversation's holder. Decisions on one stop are serialised by the wake key
  `thread:<run>:<step>:<answers>`: a second, different decision is refused `already_answered`.
- People's door: `stops/stop-door.service.ts` (`decide`, owner or manager), GraphQL mutation `decideRunStop` in
  `be/src/features/api/agent-runs/`. A plain reply to the card on /chat answers too (`stops/stop-answers.service.ts`, matched by the
  card key `run-stuck:<run>:<step>`). Run page Cancel of a thread run = the stop's `skip`.
- A confused stop is never resumed by a machine: only a decision, a NIVO deadline, or a crash re-drive moves a thread.
- Permission (`ask` ability): `domain/agent-threads/thread-approvals.service.ts` raises ONE `approve_tool_call` item
  (`tool-approval:<run>:<step>:<fingerprint>`) and a stop of kind `approval`; only the OWNER's approval counts
  (`domain/work-performers/tool-approval-performer.service.ts`); the step re-runs carrying the approved call. Thread step rows keep
  `waitItemId: null` so the old engine's item hooks never touch them.
- Lead freeze on threads = HOLD only: new wakes of the same (customer, workflow) while a stop is open become pending events and are
  replayed once, in order, when the stop closes (`domain/lead-freezes/lead-freeze-stop-holds.service.ts`, registered on
  `whenSettled` and on the sweep). No owner item, no retry: the stop card is what tells the founder.

## 4. The stop card (`workflow.stopped`)

- One card per stop, posted once under `run-stuck:<run>:<step>` in the founder's direct room (and a group only with the post right),
  then REWRITTEN IN PLACE (same message id) for the stop's life: `domain/agent-threads/stops/stop-cards.service.ts`,
  `domain/team-chat/stop-card.{contracts,schema,policy}.ts`, executor `team-chat/agent-message-post-executor.service.ts` (`rewrite`).
- The web reads `ChatMessageType.stop` (`ChatStopCardType`: kind, by, state open | answered | skipped | timed_out | resolved,
  headline, message, question, suggestions, facts, `needs`, replies, `approval`, `revision`). Draw only the controls `needs` allows;
  approval verdicts go through the work item, not `decideRunStop`. Contract and examples: `LG-REQUESTS-20261110.md` "P6 -> UX/UI".
- Facts may still hold raw codes (`agent-graphs/policies/step-trouble.policy.ts` `stuckFactsOf`): keep them collapsed.

## 5. Deadlines and the sweep

- Deadline per stop (`domain/agent-threads/thread-deadline.policy.ts`): approval 24 h, `ai_report` / `ai_error` 3 days, a template
  `wait.timeout` wins (max 20 d), `engine` stops none; env `AGENT_THREADS_APPROVAL_DEADLINE_MS`, `AGENT_THREADS_OWNER_DEADLINE_MS`.
  Armed after every drive that stops as a DELAYED outbox job (`thread-deadlines.service.ts`, key
  `thread-deadline:<run>:<step>:<repeats>.<answers>`), queue `thread_deadline` (`queues/thread-deadline/`), processor
  `be/src/features/jobs/fire-thread-deadline/`. Firing: approval -> the item is closed refused; otherwise `resume({kind:"timeout"})`.
- Sweep (`domain/agent-threads/thread-sweep.service.ts`, called each minute from `domain/agent-schedules/agent-work-sweep.service.ts`):
  re-drives only `open` threads (never stopped ones) whose run row is >= 2 min old and has no live wake; one re-drive per thread
  position, then the run fails `thread_redrive_exhausted`; repairs the projection; fires overdue deadlines; closes stops of closed runs.

## 6. Effects: the ledger (D.1)

- `domain/graph-nodes/graph-node-effects.service.ts` `once(ws, effect, call, act, { args, place })`: one act per key
  (`<run>:<step>:<16 hex>`, the hex = `callDigestOf(id, args)` in `packages/agent-sdk/src/node/host.ts`); each record keeps
  `runId`, `stepKey`, `args`, `facts`; a replay answers the kept facts. `recordsOf(ws, {runId, stepKey}, effectIds)` reads them back.
- Outcome unknown (`tool_outcome_unknown`, `delivery_outcome_unknown`, `decision_actor_unknown`): kept, and any later call under the
  key throws `EffectOutcomeUnknownError` (`graph-nodes/errors/`) without acting: a person decides. Forward only: no
  automatic undo on threads.
- One customer line per stop: the stop's `customerLines` are filled from the ledger; the send door refuses a second line from the
  stopped step to an already-told conversation (`already_told_for_this_stop`, `tools/node-tool-door.service.ts`) until an
  `answer` arrives. `alreadySent` (`agent-graphs/agent-graph-turn-policy.service.ts`) also carries lines told to the same customer by
  other open or recently resolved stops.
- Known limit: a crash between an act and its ledger row can repeat an act that has no business key of its own (a customer message).
- Hazard: the gateway's effect tools key the ledger differently (`call:<opKey>`); they refuse `no_run` today. Unify the key before
  any run token signs `stepTools`.

## 7. The agent loop inside a step (level 2)

- Default: the SDK's JSON loop (`packages/agent-sdk/src/node/host.ts`). Level 2: LangChain's prebuilt agent with native tool
  calling, `integrations/langgraph/agent-loop/` (`agent-loop.client.ts`, `step-middleware.adapter.ts`, `tool-names.policy.ts`),
  switched per node by `AGENT_LOOP=prebuilt:<node ids>` (`domain/graph-nodes/graph-nodes.config.ts`), default off.
- Rules kept as middleware: full tool set every turn, append-only messages, one tool call per turn, step allow-list and rights at
  the NIVO door, refusals as tool content, 3 tries per turn then an `ai_error` stop, `confused` -> stop. Each turn is recorded by
  content, so a kill mid-loop does not ask finished turns again. Not yet run with a real model.

## 8. Model calls: tries and metering

- 3 tries in total for an AI failure (timeout, length cut, empty, provider error): 90 s, then 45 s, 45 s; 2 s pause after a provider
  error only. Settings `AI_NODE_TIMEOUT`, `AI_NODE_RETRY_TIMEOUT`, effort `AI_NODE_REASONING` (`domain/ai-tasks/ai-tasks.config.ts`,
  `ai-tasks/call-limits.policy.ts`). Optional upstream routing `AI_NODE_PROVIDER_ONLY` / `_ORDER` / `_SORT` /
  `AI_NODE_ALLOW_FALLBACKS`: unset by design (no pin).
- Metering (`domain/ai-usage-events/ai-usage-events.service.ts`, migration `20261112012200`): each answered call books prompt,
  cached, completion, `reasoning_tokens`, `purpose` (`<node id>:<tag>`), `duration_ms`, `try_number`, `upstream`, `finish_reason`,
  cost USD. Failed tries are not booked. `callKindsByRun(ws, runId)` gives the run page one row per call kind (API not wired yet).
  Credits: `ai-usage-events/usage-cost.policy.ts` `CREDIT_USD_VALUE`, `creditsOf`.

## 9. Specs

Cross-module worlds in `be/src/tests/engine-threads/` (`thread-world*.ts`): `stops`, `ai-error`, `rights`, `replay-ledger`,
`twin-walk`, `version-pin`, `checkpoint-size`, `lease-fence`; workflows `workflows/consult/`, `workflows/reconcile/` (money world).
Run one file at a time with `--selectProjects unit`. Every new entity read must pass `queryProblems` over the real entity in its spec
(an unindexed read broke every customer message once: D-P10-1).
