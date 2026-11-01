# Agent workbench: design and worker briefs

The page where an owner works beside an agent: what the agent is doing, what waits for a person, what it has done and why. This page covers Chatbot, Sales and Accounting on one shared frame. The drawing is `D:/starci-tmp/tino/mockups/agent-workbench-mockup.html`. [agent-work-core.md](agent-work-core.md) owns the work store and the action graph (section 15), [nivo-mcp.md](nivo-mcp.md) owns the tool door, and [agents-pages.md](agents-pages.md) owns Setup and the agent list; this page adds to them and never restates them. Paths are from the repository root. W1 to W6 mean the briefs of agent-work-core.md section 13; B1, B2, B3 and P are the briefs of section 12 here.

## 1. Rulings and decisions

Owner's rulings, which every block below holds:

- Sales and Chatbot are two agents on one customer record, and the handover happens inside the conversation. The customer sees one name.
- Role content is written in code, never AI-generated UI. Which blocks an agent has, their words and their order are code. A model's words appear only as a labelled draft a person can edit.
- Every block reads the work core and real records. A number no record backs is not drawn.
- One store with rights per agent (agent-work-core.md section 15.13). Agents read through NIVO MCP. People read through member-scoped GraphQL.

Decisions this page takes:

| Question                           | Decision                                                                                                        | Why                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| One frame or three pages?          | `AgentDashboardFrame` stays the one frame, in a new order. Every module on it takes the order                   | Eleven pages already sit on it. A second frame would fork the anatomy                                                                          |
| What a conversation's speaker is   | `agent_conversations.agent_id` stays the speaker; a new nullable `front_agent_id` remembers who opened the door | `handToAgent`, the turn, the lease and the wake already follow `agent_id`, so only the name and the Chatbot's list need the new column         |
| Which link opens the why pane      | A new query key, `?why=<workItemId>`                                                                            | `?focus=` already means a conversation on Chatbot and a decision on Sales. Both are uuids, so the same key cannot carry a third meaning        |
| After a deal is won                | The conversation returns to the front agent on `DealWonEvent`. A lost deal stays with Sales                     | The drawing has a won customer's warranty question on Chatbot. No lost event exists, and a person can still take over                          |
| Stage words                        | One set for one record: New, Qualified, Proposal, Won, Lost, from `leads.stage`                                 | The drawing shows the same customer at three stages under two vocabularies                                                                     |
| Default rule of a supplier payment | `confirm_supplier_payment` becomes `auto` under 5,000,000 VND for a new install. An unclear match always asks   | A rule of `ask` beats any branch (stricter wins, section 15.4), so "under 5tr by itself" cannot exist otherwise. It records money already gone |
| "Send quote by email" block        | Dropped until a delivery path exists                                                                            | `CustomerDeliveryService` delivers into a conversation only. A not-connected block promises what connecting gives, and this gives nothing yet  |
| "Score: Hot" in the handover pack  | Dropped                                                                                                         | `leads` has no score column. The pack draws need, answers, source and last message, all from records                                           |

## 2. What the code says

Read against nivo-lite main at `8e45b40cb`, the mockup, `lane/core-w1`, `lane/core-w3`, `lane/mcp-w4` and the working tree of `lane/core-w6` on 2026-11-01. No lane named here has landed on main, so `agent-work` and `agent-graphs` exist on main as documents only. `lane/core-w6` holds contracts and policies, uncommitted. `lane/mcp-w4` is the Drive and Telegram back end for provider pages; it adds nothing a workbench reads, and it is not W4 of this page.

| The drawing assumes                            | Found                                                                                                                                                                                                                          | Consequence                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Grammar 0.19 is in the app                     | `fe/apps/web/package.json` pins 0.16.3, `node_modules` holds 0.17.1, harness pins 0.19.1, npm serves 0.19.0. The queue in `D:/starci-tmp/tino/lanes/HANDOFF.md` raises pins after this work                                    | `Stack`, `Cluster`, `Grid` (0.18), `Stepper size="dense"`, `Progress tone` (0.19) do not compile today. Section 12, order step 0 |
| `ConnectionStatus` in the status band          | `chip.choose.connection`: it states a live feed, "never a server fact the page invents". The workbench polls (agent-work-core.md section 10) and no `EventSource` exists in the web app                                        | The band uses `StatusDot` and `Badge` (`chip.choose.role:state`). `ConnectionStatus` waits for a stream                          |
| Approve is a primary button on a `ListRow`     | `FE_NO_COMMIT_IN_COLLECTION_ITEM` (CTA-6, `D:/.claude/packages/eslint-canon-fe/docs/button-intent.md`) refuses `commit` in a row. `action-group.choose.kind:item` and `ListRow.actions` allow one visible command              | A row shows one `alternative` button and a `DropdownMenu`. `commit` lives in the why pane footer, which is a decision group      |
| A why pane beside a card page                  | `pane-grid.choose.page:region`: a card page does not host a pane grid                                                                                                                                                          | With `?why=` the instance frame swaps to `Page chrome="panes"`, as Setup does (`hasPanes`)                                       |
| Chatbot keeps seeing a handed-over chat        | `handToAgent` moves `agent_id`, and `customerOfAgents` filters on it, so the chat leaves the Chatbot's inbox                                                                                                                   | `front_agent_id`, read by both                                                                                                   |
| Last turn shows in the band                    | `road` defaults to `legacy`, which writes no `agent_turns`. `lastTurnAt` stays null while the agent answers customers                                                                                                          | The band reads the later of `lastTurnAt` and the newest done item. "No turn yet" needs both empty                                |
| Expenses are a record                          | None exists. `invoice.list` is re-read each morning, an exact match only stops the reminder, and an unclear match opens one card. `AccountingLedgerKind` is `income` or `receivable`                                           | A new table, section 8                                                                                                           |
| `openPayables` can feed the screen             | It calls the gateway twice and opens work items, so it writes, and it takes up to the gateway limit per page load                                                                                                              | It runs on the morning tick only. The screen reads the table                                                                     |
| Ageing is one `Meter` with `segments`          | `segments` draws a count of equal parts, not shares                                                                                                                                                                            | Three `Meter`s, one per bucket, each with its `tone`                                                                             |
| Sales can speak on a channel                   | The inbound module list (`be/src/modules/domain/agent-connections/agent-bindings.policy.ts`) is chatbot, booking, loyalty. `MODULE_AUDIENCES.sales` is `internal`, while `lensOf` narrows any request that asks for `customer` | W4 carries both (section 11)                                                                                                     |
| `useSalesWorkbench` must take `installationId` | Sales is `multiInstance: false`, and `salesWorkbench` takes no installation                                                                                                                                                    | Nothing to do                                                                                                                    |

## 3. The frame

Order, top to bottom. The frame owns regions 1, 5, 6 and 7; a module fills 2, 3 and 4 through the slots it already has (`waiting`, `ribbon`, `tabs`).

| #   | Region      | Grammar                                                                  | Reads                                                                | Choice                                                           |
| --- | ----------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Status band | `SurfaceCard`, `Cluster justify="between"`, `StatusDot`, `Badge`, `Text` | `agentWork` (W5), `agentGraph` active version (W6), `agentDashboard` | `card.choose.role:entity`, `chip.choose.role:state`, `:fact`     |
| 2   | Waiting     | `SurfaceListCard` of `WorkbenchDecisionRow`                              | The module's own read, section 4                                     | `list-table.choose.role:entity`, `action-group.choose.kind:item` |
| 3   | Figures     | The module's block, `DescriptionList layout="stat-strip"` in one card    | The module's read model, unchanged                                   | `card.choose.role:figures`, `budgets.ribbonCells`                |
| 4   | Own areas   | `Tabs variant="secondary"` and the open panel                            | The module                                                           | `D:/.claude/contexts/ui/components/tabs.md`                      |
| 5   | Done        | `DoneRegion`                                                             | `agentDashboard.done`                                                | unchanged                                                        |
| 6   | Connections | `ConnectionsRegion`                                                      | `agentDashboard.connections`                                         | unchanged                                                        |
| 7   | Knowledge   | `KnowledgeRegion`                                                        | `agentDashboard.knowledge`                                           | unchanged                                                        |

Today the mode badge and the tabs sit first, the figures stand before Waiting and the regions stand before the panel. The move is `AgentDashboardFrameBase` only; the mode badge joins the band. The header keeps the agent, the chat command and the page tabs. W5 adds its Work tab to that strip, so the strip has five tabs where the drawing has four.

**Status band.** One line of facts, wrapping on a phone:

| Fact          | Source                                                                                                                                                                        | Words when absent                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| State         | `agentWork`: running turn gives "Working now" with an echoing dot; `workEnabled` false gives "Paused"; `breakerUntil` ahead gives "Stopped after errors"; otherwise "Running" | Header status, until W5 answers               |
| Mode          | `agentDashboard.agent.mode`                                                                                                                                                   | None                                          |
| Version       | `agentGraph(installationId)` active version                                                                                                                                   | The cell is left out, never "Version 0"       |
| Last activity | Later of `state.lastTurnAt` and `done.items[0].at`                                                                                                                            | "No activity yet"                             |
| Channels      | `agentDashboard.connections`, then the module's needs of section 9                                                                                                            | "Name: Not connected", as a `warning` `Badge` |

The band polls as W5's hook does, 5 s while a turn runs and 30 s otherwise. Every other region keeps its SWR read.

**Phone.** Same order at 390. The band wraps, figures fold to two columns as the stat strip does, and a wide table folds by `priority="low"` (`DNA-COMMON-TABLE-FOLD`). The page never scrolls sideways; the pipeline scrolls in its own `HorizontalScrollRegion`.

## 4. Deciding in place

`WorkbenchDecisionRow` is one composite on `ListRow`. A row carries `title` (the customer or supplier), `description` (one line, `DNA-COMMON-ROW-DESCRIPTION-ONE-LINE`), `badges` (state and age, at most two) and `actions`: one visible `alternative` button and a `DropdownMenu` for the rest. `children` holds, in order: the amount, what is proposed, the editor when open, the trace line of section 5, and the expiry line.

| Agent      | Rows                                                                  | Read                                               | Decide                                                         | Visible               | Menu         | Editor                                                 |
| ---------- | --------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- | --------------------- | ------------ | ------------------------------------------------------ |
| Chatbot    | `reply_customer` waiting; a chat a person holds and has not answered  | `ChatbotOverview.waiting` (new, section 6)         | `useMutateRequestChatAnswerSwr`, `useMutateSetChatHandlingSwr` | Send reply; Take over | Do not reply | `Textarea` on the draft, open by default               |
| Sales      | `SalesWorkbenchData.attention`, joined to `decisions` by `decisionId` | `useSalesWorkbench`                                | `useSalesWorkActions`, the commands of `useSalesActions`       | Approve; Follow up    | Edit, Reject | `SalesDecisionFields`                                  |
| Accounting | `AccountingWorkbenchData.questions`                                   | `useAccountingWorkbench`, `useAccountingQuestions` | `useDecideAccountingQuestion`                                  | Approve               | Reject       | The basis `Textarea`, required where the question asks |

The tabs keep their full lists (Questions, Decisions, Unanswered). Waiting shows the oldest three, then "N more" linking to that tab. A row with a required basis keeps Approve disabled until it holds text.

**Who may press.** A person with no right sees the row, the proposal and "Waiting for Dinh", with no buttons. Today that is `canAct`: owner or manager, or the assigned staff member. For a branch ask, `resumeWork` refuses anyone outside the group and the workspace owner (section 15.8), so the row takes W6's `canDecide` when present. The refusal stays on the back end either way; the button only says so early.

**After a press.** `isPending` on the pressed button, then a toast (`toast-alert.choose.owner:toast`), then the row leaves on revalidation and lands in Done, the durable owner. A refusal is a toast and the row stays. The drawing's inline "Done" line is illustration.

**Words.** Title, badges, labels and the proposal line are catalogue text or a performer's `prepare`, which is code. Only a customer draft is a model's words, and it is always in a labelled `Textarea`.

## 5. Why: the trace to the branch

**Trace line.** Under each waiting row and each done row: `Branch 5tr to under 20tr · Version 7 · Dinh approves`, then a `TextAction` "See why" to `?why=<workItemId>`. It comes from W6's batch read (section 11), by `conditionWords`, in the viewer's locale.

| What the work item has                   | The line says                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A decision, `enforced`                   | Branch, version, approver                                                                       |
| A decision, `shadow`, no `shadow_diff`   | The same: gate and branch agreed                                                                |
| A decision, `shadow`, with `shadow_diff` | The gate's reason by `ReasonCode`, and no branch. The branch did not decide, so it is not named |
| No decision (old item, no graph)         | The gate's reason by `ReasonCode`, with no "See why"                                            |

**Why pane.** `?why=` sets `hasPanes` in `AgentInstanceFrame`. The body is a `PaneGrid` with `areas` `{ base: ["list"], medium: ["list why"] }` and `columns` `{ base: ["fill"], medium: ["fill", "wide"] }`, the one child of the flush pane (`pane-grid.choose.page:nested`). `Pane area="why"` takes `collapse="drawer"`, so on a phone it is a drawer over the list (`PaneGrid` states). The list pane holds the waiting rows and Done in an app-owned `<ul>` under `PaneSection grow`: never a card inside a pane (`pane-grid.choose.frame:cards`). Status band, figures and tabs do not draw in this mode. Closing removes `why` from the query.

Bands of the why pane, each a `PaneSection`:

| Band          | Grammar                                   | Reads                                                                                                      |
| ------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Heading       | `Heading`, `Text`                         | Version and branch words                                                                                   |
| Reason        | `Text`                                    | One sentence built by code from the branch and the facts, never stored model text                          |
| Path          | `Timeline`, current step `isAttention`    | `agentGraphRun.path` (`diagram.choose.renderer:list`: a walked path has no branches)                       |
| Numbers read  | `DescriptionList`                         | `facts` with their place. The amount the model stated shows as "Not used to decide"                        |
| On which rule | `Quote` (P), source word                  | `sources`: Brain passage, chat line, template                                                              |
| Who approves  | `Avatar`, `Text`, `Progress tone`         | Approver, grant limit, `onTimeout` words. Time used against `timeoutMinutes`, with `valueText`             |
| Footer        | `PaneSection as="footer"`, `Button` group | The row's decision with `intent="commit"`, then `TextAction` "Open on the map" to `setup?run=<workItemId>` |

The footer is a decision (`action-group.choose.kind:decision`), so `commit` is right here. A module hands the frame its footer through a new prop, `whyDecision: (workItemId) => ReactNode`, and the same mutation runs as on the row. An item already closed draws no footer buttons. `Progress` tone is `warning` past half the time and `danger` past 90 percent. The graph itself stays on Setup, where W6 draws the trace with `FlowGraph` and paints it by `tone`, or `isDimmed` once the pin rises.

## 6. Chatbot

Reacts when a customer writes. Tabs: Conversations (`ChatbotInbox`, unchanged), Customers (new), Unanswered (`ChatbotGaps`, moved from a frame slot, with its count in the label). `gaps={null}` on the frame.

`ChatbotWorkbenchService.overview` gains `waiting`, one row per `reply_customer` item already read by `WorkItemsActivityService.waitingReplies`: `workItemId`, `conversationId`, `channel`, `name`, `question`, `draft`, `staffName`, `since`. No per-thread read for a row.

**Customers tab.** `SearchField`, selectable `TagGroup` (All, Needs a person, In progress, Today) and a `DataTable` over `overview.conversations`. Columns: Customer (name, company), Channel, Stage, Need (`priority="low"`), Who is replying. A row's `href` opens the conversation by `?tab=inbox&focus=<id>`, so the page passes `initialTab`, which it does not today. `ChatbotConversation` gains:

```ts
readonly lead: { readonly stage: LeadStage; readonly need: string; readonly company: string } | null
readonly respondent:
    | { readonly kind: "ai" }
    | { readonly kind: "person"; readonly name: string }
    | { readonly kind: "agent"; readonly name: string }
```

`kind: "agent"` means `front_agent_id` is set and `agent_id` differs from this workbench's agent. A chat with no lead shows a dash for stage and need. The list is the newest 200, as today, and the table says so when it is full. Fix `emptyListBody` to name Zalo in both catalogues. A figures block with no sample keeps its dash and its "needs" line; zero stays a real zero.

**By channel.** With at least one chat channel connected, the Conversations tab also shows "Conversations by channel": today's count per bound channel, counted from `overview.conversations`, then the needs block of section 9.

## 7. Sales

Follows the deal. Tabs stay: Attention, Pipeline, Decisions, Handoff to accounting, Contracts, Activity. `SalesFigures` stays. New: the Waiting slot (section 4), and `SalesConversation`, drawn in the panel when `?conversation=<id>` is present, on the same `ChatbotThreadView` and `ChatbotSidePanel` the inbox uses. It shows the thread, the handover line, the pending decision as a `WorkbenchDecisionRow` under the last message, and the side panel of section 7.1. `SalesDecision` and `AttentionRow` gain `conversationId`, from `latestOfLead`.

Pipeline stays `SalesPipeline`: five lanes in a `HorizontalScrollRegion`, with app layout in its `fe/apps/web/src/components/blocks/SalesPipeline/classNames.ts` (FE-CSS-1). The stage `Stepper` stays in the side panel, not on a card.

### 7.1 Side panel of a shared conversation

| Band            | Chatbot sees                                           | Sales sees                          | Reads                                          |
| --------------- | ------------------------------------------------------ | ----------------------------------- | ---------------------------------------------- |
| Who is replying | "Sales is handling this. Chatbot is silent", Take over | "Handed over at 10:05", Take over   | `respondent`, `conversation_ownership_events`  |
| Stage           | `Stepper size="dense"`, five steps                     | The same                            | `leads.stage`; `paused` while a decision waits |
| Record          | Need, phone, Open record                               | Need, answers, source, last message | `ChatbotLead`, `context_summary`               |
| Why handed over | Sentence and trace line                                | Trace line                          | The `handoff_lead` work item                   |

Both views read the same lead. No block copies a customer field.

## 8. Accounting and expenses

The shop's numbers. Tabs stay: Overview, Evidence, Questions, Ledger. `AccountingFigures` stays. New: the Waiting slot, Upcoming, and expenses.

### 8.1 The record

Capability `be/src/modules/domain/supplier-payables`, imports platform only (R27). Migration `db/migrations/20261110000800_supplier-payables.sql`, expand only, policy shape as agent-work-core.md section 3. Entity extends `UuidAbstractEntity` (R342).

| Table               | Key                                                          | Columns                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supplier_payables` | id, unique (`workspace_id`, `seller_tax_code`, `invoice_no`) | `supplier`, `amount_vnd` bigint, `issued_on`, `due_on`, `status` (`open`, `paid`), `debit_ref`, `paid_at`, `work_item_id`, `first_seen_at`, `decided_by` |

### 8.2 The flow

```
morning tick ── DeskDailyService.run ── SupplierPaymentsService.openPayables
                 │ invoice.list, payment.debits.list, through the gateway by role
                 │ upsert every listed invoice as `open`
                 │ matchPayables
                 ├─ exact   ─> askSupplierPayment                  gate and branch decide
                 ├─ unclear ─> askSupplierPayment, forceAsk        always a person
                 └─ open    ─> stays open, keeps reminding
runWork(confirm_supplier_payment), subject { supplier_payable, id }
                 │ auto or approved
                 v
SupplierPaymentPerformer ── row `paid`, debit_ref, paid_at ── ledger line of kind `expense`
```

An exact match today closes in silence. Sending it through `runWork` is what lets the graph's bands decide it, and it is the only way an expense appears in a ledger. The subject becomes the row, so `GraphFactReader` reads `supplier_payment.amount_vnd` from a record and never from the seed. A rejected item leaves the row `open`, which keeps reminding, as today.

The default rule becomes `mode: "auto"`, `limitVnd: 5_000_000`, `amountLimit: true`. Existing workspaces keep their stored `ask`, so they get a card for each payment until the owner changes the rule: it fails towards asking.

### 8.3 On the screen

`AccountingWorkbenchData` gains:

```ts
readonly upcoming: ReadonlyArray<UpcomingDue> | null // null: no tax profile in the Brain
readonly payablesSource: string | null // the tool that answered `invoice.list`, null when none
```

`AccountingService.workbench` reads `upcoming` with `taxProfileOf`, `payablesDue` over the `open` rows and `upcomingDues`, and never `openPayables`. `AccountingLedgerKind` gains `expense`, `AccountingTargetType` gains `supplier_payable`, and `buildLedger` adds one line per `paid` row, with its lineage (payment, decision). An expense line takes no correction form in this work. `ledgerFoot` changes: only confirmed supplier payments are recorded as expenses, in both catalogues.

**Upcoming** sits on the Overview tab, beside the ageing: `SurfaceListCard` label outside, `ListRow` title (Monthly VAT 10/2026, or supplier and invoice), description (due date and legal basis, or amount), `Badge` for days left, `warning` within `reminderDays`, `danger` when past. The basis text is the tax basis map in `be/src/modules/domain/accounting/messages/accounting-desk.messages.ts`, in code. With `upcoming` null it shows an `EmptyNotice` that opens the Brain. Ageing is three `Meter`s. Income by week stays `Meter` rows.

## 9. Not connected and empty

The rule: zero is a real number; a figure that cannot be known says what it needs; a block that needs a connection says so, states what connecting gives, and links to one place. A block never estimates what is missing. A not-connected block is drawn only for a feature that works once connected.

Needs are code, `workbenchNeedsOf(module)` in `fe/apps/web/src/modules/utils`, one entry per need: an id, a title key, a body key, and either `providers` (matched against `agentDashboard.connections`) or a `source` flag from the read model. `NeedsBlock` draws each unmet need as a `SurfaceCard` with `IconTile`, `Text`, a `warning` `Badge` and one neutral `Button` to Settings, Connections (`Alert` with `action` where it stands inside a band). All three desks draw it at the end of the panel it concerns.

| Agent      | Need                   | Met by           | Figure effect                                                       |
| ---------- | ---------------------- | ---------------- | ------------------------------------------------------------------- |
| Chatbot    | Facebook and Instagram | Provider `meta`  | Counts stay real for the channels connected                         |
| Sales      | Leads from ads         | Provider `meta`  | Facebook is left out of Conversion by source, and the block says so |
| Accounting | Money received         | `creditsSource`  | Unmatched money reads "Payment gateway not connected", never 0      |
| Accounting | Supplier invoices      | `payablesSource` | Upcoming lists tax only, and the Evidence tab draws the block       |

| State                 | Draws                                                                                 | Rule                                       |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| Nothing waits         | `EmptyNotice` in the waiting card; no action                                          | `empty-state.choose.cause:empty`           |
| No activity yet       | Band says so; figures are real zeros; a figure with no sample keeps its dash and need | The rule above                             |
| No conversations      | `EmptyNotice` naming website, Zalo and Telegram                                       | `empty-state.choose.cause:empty`           |
| No money, no invoices | Evidence keeps both notices, with Record by hand as the one action                    | `DNA-COMMON-EMPTY-ONE-ACTION`              |
| Filter finds nothing  | `EmptyNotice` offering to clear                                                       | `empty-state.choose.cause:filtered`        |
| A read failed         | That region only, through `SlotView`, with retry                                      | `empty-state.choose.cause:failed`, STATE-8 |
| Graph not there yet   | No version cell, no "See why"; the gate's reason stands                               | Section 5                                  |

## 10. Handover inside the conversation

```
Chatbot turn ── reply.lead ── CustomerOutcomesService.handOff ── handoff_lead through the gate
   │
HandoffLeadPerformerService.perform
   │ attachLead, as today
   │ AgentConversationsService.handOver(conversation, Sales agent bound to this connection)
   │    front_agent_id = COALESCE(front_agent_id, agent_id), agent_id = Sales, ownership event, one transaction
   v
next customer message ── hear ── turn on conversation.agent, now Sales
   │ persona: Sales's role and instructions, under the front agent's name
   │ wake source `customer`: public view, grants, the Sales binding's access
   v
quote: send_quote waits for the approver in the thread ── approved ── CustomerDeliveryService into the same conversation
```

- `TurnHandoffService.move` and the performer share one method, `AgentConversationsService.handOver`, extracted to the lower capability so no owner cycle appears (R27). It records through `ConversationOwnershipEventsService`.
- With no Sales agent bound to `inbound_chat` on that connection with `ask` or `auto` access, nothing moves: the lead is captured and Chatbot keeps answering, as today.
- `handled_by IS NULL` already guards the move, so a person who holds a chat keeps it. Take over works from both desks because both write `handled_by`.
- `personaOf` writes the speaker's role and instructions under `agent.speaksAs`, which is the front agent's name when `front_agent_id` is set. The customer's channel shows the OA or the bot either way.
- `customerOfAgents` reads `agent_id IN (...) OR front_agent_id IN (...)`, so Chatbot keeps the chat, and it does not run: a turn runs for `agent_id` only.
- `handoff_lead` is `auto` by default, so the handover needs no approval. The line "Lead handed to Sales AI" stays a staff-only system line (`customerTurns.chatHandoff`).
- On `DealWonEvent` a reactor hands the conversation back to `front_agent_id` if a Sales agent still speaks in it and no person holds it.
- Sales reads the customer through a NIVO MCP tool, section 11. It never reads the Chatbot's turns or memory.

## 11. Reads, rights and what each lane must give

The screens read GraphQL under the member's role. No workbench read calls a tool. Agents read through NIVO MCP, under the three layers of section 15.13, and a right held in the graph is what lets a tool answer.

| Agent      | Data kind                                    | Scope of the turn                                                      | Fields                                                                |
| ---------- | -------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Chatbot    | Public knowledge, orders, customer brief     | The customer of this conversation                                      | Selling price, never cost                                             |
| Sales      | Customer records, quotes, orders, price list | This conversation on a customer wake; the workspace on an internal one | Never the ledger. Payment status by hand-over tool: "paid" or "owing" |
| Accounting | Ledger, invoices, payments, supplier records | Workspace. It has no outside channel                                   | Payer names masked unless the step needs them                         |

A new native read tool, `customer.brief`: no input, the conversation from the caller, answering `{ stage, need, company, source, lastCustomerAt, phoneMasked }`, `not_found` for a call with no conversation, `internalOnly: false`. It follows nivo-mcp.md section 5.3: read scope, default deny, `secretFields`. Sales's knowledge card keeps "public and internal"; on a customer wake the view is public, and the card says so.

Needs from the lanes in flight, each named once here and in the brief that uses it:

| From | Must give                                                                                                                                                                                                                                                                                              | For |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| W4   | `sales` in the inbound module list, last, so it is never the front door while another inbound agent is bound; a customer turn of Sales runs with audience `customer`; `reply_customer` settles under the speaker's binding, not a hard-coded chatbot one                                               | B2  |
| W5   | `agentWork(installationId)` with `state.lastTurnAt`, `workEnabled`, `breakerUntil` and the running turn, through `fe/apps/web/src/hooks/agentWork`, polling as section 10 says; a Recent turns row linking `setup?run=<workItemId>`                                                                    | B1  |
| W6   | `agentGraph` active version; `agentGraphRun(workItemId)` open to the assigned staff member too, not only owner or manager; a batch `agentGraphRuns(workItemIds)` for trace lines, at most 50 ids, giving version, branch words, approver words, `shadowDiff`, `canDecide` and `timeoutAt`, with no N+1 | B1  |
| W6   | The `supplier_payment.amount_vnd` reader takes its subject from `supplier_payables` once B3 lands. Until then an unread fact takes `else`, which asks, so nothing runs alone                                                                                                                           | B3  |
| W6   | `DataRight` kinds for `customer` and `conversation` scope, enforced on `customer.brief` by the gateway layer of section 15.13                                                                                                                                                                          | B2  |

If W4, W5 or W6 has shipped without an item here, the brief that needs it reports the gap and stops at that step; it does not build the item in the lane's paths.

## 12. Grammar, order and briefs

### 12.1 What composes

Against 0.19.1:

| Drawn              | Composes?                                                                                                                                                                       | Result          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Lane board         | Yes. `HorizontalScrollRegion` around app columns in `fe/apps/web/src/components/blocks/SalesPipeline/classNames.ts` (FE-CSS-1). `SalesPipeline` does this today and passes lint | No package work |
| Bar chart          | Yes. `Meter` rows carry income by week, as they do today. `recharts` is the stack's chart library (`D:/.claude/contexts/stack/fe.yaml`) if a real chart is ever wanted          | No package work |
| Source quote box   | No. It needs a tinted box at the nested inset inside a pane. `SurfaceCard` may not stand there (`pane-grid.choose.frame:cards`), and `Alert` reports an outcome, not a quote    | Package brief P |
| `ConnectionStatus` | Not used: no feed (section 2)                                                                                                                                                   | None            |
| `Stepper dense`    | Yes, section 7.1                                                                                                                                                                | Needs the pin   |
| `Progress tone`    | Yes, section 5                                                                                                                                                                  | Needs the pin   |

Until P lands, B1 draws a source as `Text` with a source word and a byline, on no ground, and swaps to `Quote` when the pin carries it.

### 12.2 Order

| Step | What                                                    | Waits for                                                               |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| 0    | Lane owner raises `@starci/grammar` and its lint family | npm serving the version, front-end lanes quiet. Workers may not do this |
| 1    | P                                                       | Nothing; it merges on the harness                                       |
| 2    | B1                                                      | Step 0, W5, W6                                                          |
| 3    | B2 and B3, in parallel                                  | B1. B2 also W4, W6 and `lane/mcp-w2`. B3 also W6                        |

Migration numbers: W6 holds `0400` to `0600`. B2 takes `20261110000700`, B3 `20261110000800`.

### 12.3 Common to all briefs

Read `D:/starci-tmp/tino/lanes/LANE-BRIEF.md`, then `D:/.claude/AGENTS.md`, `D:/.claude/contexts/README.md`, `D:/.claude/contexts/harness/rules.md`, then this page and `D:/starci-tmp/tino/mockups/agent-workbench-mockup.html` whole. Where this page and the drawing differ, this page wins (section 2). A front-end brief also reads `D:/.claude/contexts/ui/README.md`, `D:/.claude/contexts/ui/composition.md`, `D:/.claude/contexts/ui/components/list-table.md`, `D:/.claude/contexts/ui/components/pane-grid.md`, `D:/.claude/contexts/ui/components/empty-state.md`, `D:/.claude/contexts/ui/components/chip.md` and `D:/.claude/contexts/code/fe/README.md`. Look a rule up, never remember it (rule 7): `node D:/.claude/cli/dist/main.js contexts search "<english question>" --also "<action>" --also "<artifact>" --scope ui,grammars,code,hfs --limit 10`; open the hit and cite it. Every "never" here carries its id for that reason.

Each app brief works in its own worktree, from main, after its order step:

```sh
git -C D:/starci-lanes/nivo-lite worktree add -b wb-<id> D:/starci-lanes/nivo-wb-<id> main
cmd //c mklink //J 'D:\starci-lanes\nivo-wb-<id>\node_modules' 'D:\starci-lanes\nivo-lite\node_modules'
```

Touch only your paths (rule 4); a defect outside them goes in your report. Keys in `fe/apps/web/src/modules/i18n/messages/vi.json` and `fe/apps/web/src/modules/i18n/messages/en.json` are yours only under the namespace your brief names; both files change by hunk. `be/contracts/api/schema.graphql` is emitted, never edited; the second brief to land emits it again. Commit on your branch with the hook on. Never: `eslint-disable`, `ts-ignore`, `as` casts, `--no-verify`, gate edits, stash, `reset --hard`, a branch switch in another checkout, `npm install`, `deps source`, `git push`, deploy, a migration on a shared database, opening `*.env` or `*.enc*` (LANE-BRIEF; rules 1, 2, 3). TS holds no raw SQL: CRUD through entities, anything else `callDbFunction` (R334). Imports point down: block, composite, branch, leaf; a block never imports a block. No AI-written text in a heading, label, figure or reason (section 1).

Done for a back-end part: every public method covers its branches and its dependencies' answers (BE-TEST-5), full coverage on logic files (R273), no owner import cycle (R27); `cd be && npx eslint -- <files>`, `npx --no-install tsc --noEmit -p be/tsconfig.json`, `npm run typecheck:tests` clean; `npx --no-install starci app check --wiring` shows 0 failures (R272); `npx --no-install starci app emit` run when GraphQL changed. Done for a front-end part: no spec (SHARED-TEST-1); `cd fe && npx eslint --max-warnings=0 --no-warn-ignored -- <files>` and `cd fe/apps/web && npx tsc --noEmit -p tsconfig.json` clean; a walk at 1280 and 390, light and dark, in owner, manager and assigned staff role, of every state your section names, reporting what could not be walked. A step needing Docker with Docker down is reported blocked, not skipped (rule 8). Report the branch sha. The lane owner lands it and removes the worktree, unlinking the junction first.

### B1: the frame

Id `frame`. Sections 3, 4, 5 and 9. Order step 2. No back-end change. Needs from W5 and W6: section 11.

Paths: `fe/apps/web/src/components/blocks/AgentDashboardFrame/**`, `fe/apps/web/src/hooks/agentDashboard/**`, `fe/apps/web/src/components/blocks/AgentInstanceFrame/index.tsx` (the `hasPanes` line only), `fe/apps/web/src/components/blocks/WorkbenchWhy/**` (new), `fe/apps/web/src/components/composites/WorkbenchStatusBand/**` (new), `fe/apps/web/src/components/composites/WorkbenchDecisionRow/**` (new), `fe/apps/web/src/components/composites/WorkbenchWaitingList/**` (new), `fe/apps/web/src/components/composites/NeedsBlock/**` (new), `fe/apps/web/src/components/branches/WorkbenchTraceLine/**` (new), `fe/apps/web/src/hooks/workbench/**` (new), `fe/apps/web/src/modules/types/workbench.ts` (new), `fe/apps/web/src/modules/types/index.ts` (one export hunk), `fe/apps/web/src/modules/utils/workbenchNeeds.ts` (new), and keys under `workbench` in `fe/apps/web/src/modules/i18n/messages/vi.json` and `fe/apps/web/src/modules/i18n/messages/en.json`.

Build: the frame order of section 3; `WorkbenchStatusBand` with the absent column honoured for each fact; `whyDecision` and a `waiting` slot that stays optional, so a module with neither draws `WaitingRegion` as now; `WorkbenchWaitingList` taking `surface: "card" | "pane"`, the card as `SurfaceListCard` and the pane as an app-owned `<ul>`; `WorkbenchDecisionRow` with the slots of section 4; `WorkbenchTraceLine` with the four cases of section 5; `useWorkbenchTraces(ids)` over W6's batch; `?why=` read in `AgentInstanceFrame` and the frame's pane body; `WorkbenchWhy` with all bands, using `Timeline`, `DescriptionList` and `Progress` with `tone` and `valueText`; `workbenchNeedsOf` with the table of section 9 and `NeedsBlock`. All eleven module pages stay as written and take the new order through props they already pass.

Done: section 12.3, plus one row of each case of section 5 walked on seeded data, every module page opened once to prove the reorder broke none, and a phone drawer open and closed by the query. No per-agent page changes here.

### B2: one customer, Chatbot and Sales

Id `customer`. Sections 4, 6, 7, 9, 10 and 11. Order step 3. Needs from W4 and W6: section 11, and `lane/mcp-w2` on main for the tool.

Paths, back end: `db/migrations/20261110100400_conversation-front-agent.sql` (new: the column, and the pgmq queue of the consumer, R336, R258), `be/src/modules/domain/agent-conversations/**`, `be/src/modules/domain/agent-connections/agent-bindings.policy.ts` and spec (only if W4 left the order of section 11 unfinished), `be/src/modules/domain/customer-turns/turn-handoff.service.ts` and spec, `be/src/modules/domain/customer-turns/turn-prompt.policy.ts` and spec, `be/src/modules/domain/work-performers/handoff-lead-performer.service.ts` and spec, `be/src/modules/domain/chatbot-workbench/**`, `be/src/modules/domain/sales-workbench/**`, `be/src/features/api/chatbot/**`, `be/src/features/api/sales-workbench/**`, `be/src/features/reactors/conversation-handback/**` (new), `be/src/modules/domain/mcp-gateway/` (one new adapter file with spec, and one line in `mcp-gateway.module.ts`), `be/apps/api/src/compose/reactors.ts` (one line), `be/contracts/api/schema.graphql` (emitted), `be/src/tests/integration/agent-work/workbench-handover.integration-spec.ts` (new).

Paths, web: `fe/apps/web/src/features/pages/ChatbotWorkbenchPage/**`, `fe/apps/web/src/features/pages/SalesWorkbenchPage/**`, `fe/apps/web/src/components/blocks/ChatbotWaiting/**`, `fe/apps/web/src/components/blocks/ChatbotCustomers/**` (new), `fe/apps/web/src/components/blocks/SalesWaiting/**` (new), `fe/apps/web/src/components/blocks/SalesConversation/**` (new), `fe/apps/web/src/components/composites/ChatbotSidePanel/**`, `fe/apps/web/src/hooks/chatbot/**`, `fe/apps/web/src/hooks/chatbotWorkbench/**`, `fe/apps/web/src/hooks/chatbotView/**`, `fe/apps/web/src/hooks/salesworkbench/**`, `fe/apps/web/src/hooks/sales/**`, `fe/apps/web/src/hooks/swr/api/graphql/queries/useQueryChatbot*`, `fe/apps/web/src/modules/api/graphql/queries/query-chatbot*`, `fe/apps/web/src/modules/api/graphql/queries/query-sales-workbench.ts`, `fe/apps/web/src/modules/utils/leadStage.ts` (new), and keys under `workbenchChatbot` and `workbenchSales` in `fe/apps/web/src/modules/i18n/messages/vi.json` and `fe/apps/web/src/modules/i18n/messages/en.json`.

Build: `front_agent_id` and `handOver` with `TurnHandoffService` moved onto it; `speaksAs` on `TurnConversation`; the performer's handover; the two-sided `customerOfAgents`; the reactor on `DealWonEvent`; `waiting`, `lead` and `respondent` on the overview; `conversationId` on Sales rows; `customer.brief`; the Chatbot Waiting rows; Customers tab; Unanswered moved into a tab; Conversations by channel; `SalesWaiting`; `SalesConversation`; the side panel of section 7.1 with `Stepper size="dense"`; `leadStageLabel`, replacing `stage_*` and `stage*` uses of both desks, with dead keys removed; `emptyListBody`.

Specs: `handOver`: moved, already there, held by a person, second hand-over keeps the first `front_agent_id`. Performer: Sales bound moves; none bound stays; access `read` stays; the test chat stays. `personaOf`: with and without `speaksAs`. `customerOfAgents`: front and speaker both find it. Overview mapper: each `respondent`, a chat with no lead, `waiting` from a proposal with and without `conversation_id`. Reactor: moves back; a person holding stays; repeat changes nothing. `customer.brief`: another customer's id is unreachable, no conversation answers `not_found`, phone masked, no right refuses. Integration `handover-one-name`: Chatbot captures, Sales answers the next message under the front name, Chatbot's list still holds the chat and runs no turn. Integration `quote-in-thread`: an approved `send_quote` lands in the same conversation.

Done: section 12.3, plus a walk of the handover screens as drawn from both desks, in `legacy` and `core` road, migration applied by the integration world only. If `reply_customer` cannot settle under Sales, stop and report (section 11). Report the statement that binds a Sales agent to a channel; do not run it.

### B3: expenses and Upcoming

Id `expenses`. Sections 4, 8 and 9. Order step 3. Needs from W6: section 11.

Paths, back end: `db/migrations/20261110000800_supplier-payables.sql` (new), `be/src/modules/domain/supplier-payables/**` (new), `be/src/modules/domain/accounting/**`, `be/src/modules/domain/ledger/**`, `be/src/modules/domain/modules/accounting.contracts.ts` (the one rule), `be/src/features/api/accounting/**`, `be/src/modules/platform/database/entities.ts` (one import, one spread), `be/apps/api/src/compose/accounting.ts`, `be/contracts/api/schema.graphql` (emitted), `be/src/tests/fixtures/builders/supplier-payables.builder.ts` (new; no integration spec for supplier expense was built).

Paths, web: `fe/apps/web/src/features/pages/AccountingWorkbenchPage/**`, `fe/apps/web/src/components/blocks/AccountingWaiting/**` (new), `fe/apps/web/src/components/blocks/AccountingUpcoming/**` (new), `fe/apps/web/src/components/blocks/AccountingOverviewPanel/**`, `fe/apps/web/src/components/blocks/AccountingLedgerPanel/**`, `fe/apps/web/src/components/blocks/AccountingEvidencePanel/**`, `fe/apps/web/src/components/composites/AccountingOverview/**`, `fe/apps/web/src/components/composites/AccountingLedger/**`, `fe/apps/web/src/components/composites/AccountingEvidence/**`, `fe/apps/web/src/hooks/accounting/**`, `fe/apps/web/src/hooks/accountingRecords/**`, `fe/apps/web/src/modules/api/graphql/queries/query-accounting-workbench.ts`, the accounting types in `fe/apps/web/src/modules/types/`, and keys under `workbenchAccounting` in `fe/apps/web/src/modules/i18n/messages/vi.json` and `fe/apps/web/src/modules/i18n/messages/en.json`.

Build: the table, entity and service; the flow of section 8.2, with exact matches through `runWork` and `forceAsk` kept for unclear ones; the performer; the rule; `upcoming` and `payablesSource` by section 8.3, reading no gateway tool beyond the existing source check; the expense line and its lineage; the ledger filter and `ledgerFoot`; the Waiting rows and `whyDecision` wiring; Upcoming; three ageing `Meter`s; the Evidence block. `SupplierPaymentsService.openPayables` still answers what reminders need.

Specs: `openPayables`: first seen writes one row, a repeat writes none, exact runs the gate with no `forceAsk`, unclear keeps it, already paid asks nothing. Performer: sets `paid` once, a retry changes nothing. Workbench: `upcoming` with no profile is null, with rows merges tax and supplier, reads no tool. `buildLedger`: a paid row is one `expense` line, an open row none, test records excluded. Policy of the rule: 4,999,999 runs alone, 5,000,000 asks, a stored `ask` asks at any amount. Integration `exact-expense-ledger`: invoice plus debit reaches a ledger line. Integration `no-write-on-read`: a workbench read writes no row and calls no `invoice.list`.

Done: section 12.3, plus the Accounting screens as drawn, with and without SePay, with and without `invoice.list`, migration applied by the integration world only.

### P: Quote, a package edit

Not an app worktree: `starci pkg branch quote-block`, as `D:/.claude/contexts/authority/packages.md` says. Grammar edits are content only: no specs, no local plays, proof by the package's `typecheck` and `build`, and only `@starci/grammar` is bumped, with its CHANGELOG entry.

Paths, under the worktree it prints: `D:/.claude/packages/grammar/src/core/composite/Quote/index.tsx` (new), `D:/.claude/packages/grammar/src/common/renderers.ts`, `D:/.claude/packages/grammar/src/common/registry.tsx`, the sheet that holds composites, a story, `D:/.claude/contexts/grammars/contract.yaml` and `D:/.claude/contexts/grammars/contract.md` (the `Quote` role), `D:/.claude/contexts/ui/components/quote.md` (new, with its Choose table), and a ruling in `D:/.claude/contexts/decisions/rulings.yaml`. Read first: `D:/.claude/contexts/README.md` rows "New pattern or rule" and "change a canon package", `D:/.claude/contexts/grammars/contract.md`, `D:/.claude/contexts/grammars/common.md`.

Spec: `Quote` shows words from a source, as `<blockquote>`: `children` (the words), `source` (a short word: Brain, Chat, Template), `byline` (where and when), `isSkeleton`. A tinted ground and the nested inset, `--grammar-inset-nested`, one radius below the host. No shadow, no outline, no action. It is legal in a `Pane`, a card and a drawer, because it is not a surface. The name is generic (ruling `grammar-names-are-generic`). Add it to the Common registry, so every family renders it.

Done: `starci pkg test grammar` green, `starci pkg handoff`, branch sha reported. The app swap is one line in B1's `WorkbenchWhy`, done after the pin carries it.
