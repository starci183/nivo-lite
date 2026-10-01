# NIVO OS prototype — brief for UI agents

Worktree: `D:/starci-lanes/prototype` (branch `lane/prototype`). App: `apps/prototype` (Next.js 16 App Router, React 19,
Supabase local, DeepSeek). Deadline: demo tomorrow. Optimise for a polished, working demo.

## The product (one customer journey)
NIVO OS = responsibility operating system for founder-led service SMEs. Every piece of work has ONE accountable owner
(human or AI agent), ONE explicit next action, and evidence of its outcome. Humans approve anything leaving the company.

Journey: customer chats with the **Chatbot** agent → lead captured with context → AI proposes a **responsibility**
(owner + next action + due) → owning agent **drafts** the follow-up → human **approves / edits / rejects** (Office or lead page)
→ **outcome + evidence** recorded → full **history** (append-only audit).

Modules catalog (like NIVO): Chatbot (installable, works), Sales and Accounting (listed, "Coming soon", not installable).
An installed module = an **agent** with setup (name, @handle, role, instructions, business knowledge, greeting, approval rule, active/paused).
Office = team group chat: humans + agents; `@handle` makes that agent reply.

## Hard rules
1. **Read `apps/prototype/UI-RULEBOOK.md` first** and follow it: compose `@starci/grammar/common` + `@nivo/ui` components,
   semantic tokens only (no hex, no arbitrary px, no `gap-2.5`), ONE filled primary Button per view, `SurfaceCard`/
   `SurfaceListCard` on the grey canvas, `EmptyNotice` for empty, `isSkeleton` for loading, `Badge` tones only for real states,
   Heroicons via `NivoIcon`/`nivoIconSource`. Mirror NIVO's Office vocabulary (task card, approval card, members rail).
   Check real prop names in `node_modules/@starci/grammar/dist/common/index.d.ts` (apps/prototype's own copy, v0.5.4)
   and `packages/ui/src/**` before using a component. Look at `apps/app/src/**` for real usage examples (read-only).
2. **UI copy is English** (the TECHFEST submission is in English). Plain operational sentences, no emoji, no "!".
3. **Only create/edit files you own** (listed in your task). Never edit `src/lib/**`, other agents' folders,
   root config, package.json. If you need a data/action change, describe it in your final report instead.
4. **No git commands at all** (no commit, no stash, no checkout). Do not run `npm install`. Do not start the dev server
   (the lead integrates and runs it). Verify with `cd D:/starci-lanes/prototype/apps/prototype && npx tsc --noEmit`
   — fix errors in YOUR files; ignore errors that come only from files another agent has not written yet.
5. Server components by default for pages (call functions from `@/lib/queries`, `getSession` from `@/lib/session`).
   Interactive parts are `"use client"` components that call server actions from `@/lib/actions`
   (they return `Outcome<T>` = `{ok:true,data}|{ok:false,error}` — show `error` inline with `Alert`/field error),
   use `useTransition` for pending state (`isPending` on the initiating Button), then `router.refresh()`.
   Never pass functions from a server component to a client component.
6. Data is illustrative/anonymised ("Customer A — B2B Service"). Never invent metrics, revenue or percentages in UI.
7. Arrow-function components, `type XProps = {...}`, `on…` handler names, a short `/** */` on each export.
   Put long className strings in a colocated `classNames.ts` when you need layout wrappers (`<div className={...}>`).

## Data layer (already written — read, do not edit)
- `src/lib/types.ts` — Workspace, Agent, AgentConversation, AgentMessage, Lead, Responsibility, Execution, Message, EventRow, LeadDetail, Outcome.
- `src/lib/queries.ts` (server) — listAgents, getAgent, listLeads (LeadRow with owner_name/next_action), listResponsibilities (with lead),
  getLeadDetail(leadId) → LeadDetail {lead, responsibilities, executions, events, agents}, listMessages, listRecentEvents.
- `src/lib/session.ts` — getSession() → {userId, userName, email, avatarUrl, workspace} (creates + seeds workspace on first visit).
- `src/lib/modules.ts` — MODULES catalog, moduleSpec(key).
- `src/lib/actions.ts` ("use server") — signOut, installAgent(module, setup), suggestAgentSetup(description), updateAgent(id, patch),
  listConversations(agentId), listAgentMessages(conversationId), startConversation(agentId, "test"|"customer", visitorName?),
  sendAgentMessage(conversationId, body) → {reply, capturedLeadId}, createLead({contact_name, company, channel, need}),
  refreshContext(leadId), suggestResponsibility(leadId), assignResponsibility(respId, {owner:"human"|agentId, next_action, due_at, title?}),
  draftExecution(respId), decideExecution(executionId, "approved"|"rejected", editedDraft?), recordOutcome(leadId, stage, evidence),
  addResponsibility(leadId, {...}), sendTeamMessage(body) → Message[].
- `src/lib/supabase/browser.ts` — supabaseBrowser() for realtime subscriptions (tables `messages`, `agent_messages` are in the realtime publication).

## Routes (all under `src/app/(console)/` except auth)
| Route | Screen | Owner |
|---|---|---|
| `/login`, `/auth/callback` | Google sign-in (+ local demo sign-in) | A1 |
| `(console)/layout.tsx` | App shell: header + sidebar (Overview, Office, Leads, Responsibilities, Modules) | A1 |
| `/dashboard` | **P01 Executive view** (landing page is `/`) | A2 |
| `/responsibilities` | Responsibility board | A2 |
| `/leads` | Leads list + new lead | A3 |
| `/leads/[id]` | Lead page composition + **P02 Context** panel | A4 |
| (panel) | **P03 Responsibility / Owner / Next action** | A5 |
| (panel) | **P04 Human × AI execution** (draft → approve) | A6 |
| (panel) | **P05 Outcome / Evidence / History** | A7 |
| `/chat` | **Office** team chat + Tasks tab + approval cards | A8 |
| `/modules`, `/modules/new`, `/modules/[agentId]` | Module catalog, install, agent setup | A9 |
| `/modules/[agentId]/chat` | Agent chat: Test tab + Customer channel (simulated) tab | A10 |

Lead page panel contract (A4 imports these; A5–A7 create them), each a server-safe component taking `{ detail: LeadDetail }`:
- `src/features/lead-detail/responsibility/index.tsx` → `export const ResponsibilityPanel`
- `src/features/lead-detail/execution/index.tsx` → `export const ExecutionPanel`
- `src/features/lead-detail/outcome/index.tsx` → `export const OutcomePanel` and `export const HistoryPanel`
