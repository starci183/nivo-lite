import { OfficeMessenger } from "@/features/office"
import { hydrate, listDecidedApprovals, listPendingApprovals, type Embedded } from "@/features/office/queries"
import { listExceptions, listWorkItems, getGovernance, governanceFrom, listStaff, workViewsFrom } from "@/lib/flow-queries"
import type { Staff, WorkItemView } from "@/lib/flow-types"
import { leadRowsFrom, listAgents, listLeads, listMessages, listResponsibilities } from "@/lib/queries"
import { listMembers, memberListingsFrom } from "@/lib/members"
import { getOfficeData } from "@/lib/page-data"
import { getSession } from "@/lib/session"
import { supabaseServer } from "@/lib/supabase/server"
import type { Agent, Message } from "@/lib/types"
import { COMMAND_LINE_AUTHOR } from "@/lib/agent-command-rules"
import { listCommandCandidates } from "@/lib/office-command"

/** Always render fresh: messages and approvals change constantly. */
export const dynamic = "force-dynamic"

const RECENT_CUSTOMERS = 5

/** Office: the team messenger with agents, approvals inside the thread, and team tasks. */
const ChatPage = async () => {
  // ONE request (SQL function office_data) returns every row the Office reads; if it is unavailable the separate reads below take over.
  const raw = await getOfficeData()
  const session = await getSession()
  const [messages, agents, responsibilities, pending, decided, leads, exceptionRows, recentItems, governance, staffRows, members] = raw
    ? [
        [...raw.messages].reverse(),
        raw.agents,
        raw.responsibilities,
        await hydrate(raw.pending as Array<Embedded>),
        await hydrate(raw.decided as Array<Embedded>),
        leadRowsFrom(raw.leads, raw.open_responsibilities),
        workViewsFrom(raw.exceptions),
        workViewsFrom(raw.recent_items),
        (() => { try { return governanceFrom(raw.governance, raw.since7) } catch { return null } })(),
        raw.staff as Array<Staff>,
        memberListingsFrom(session.workspace.id, raw.members),
      ] as const
    : await Promise.all([
        listMessages(),
        listAgents(),
        listResponsibilities(),
        listPendingApprovals(),
        listDecidedApprovals(),
        listLeads(),
        // The flow engine may not be ready yet: the Office must still render without it.
        listExceptions().catch((): WorkItemView[] => []),
        listWorkItems({ status: ["done", "rejected"], limit: 40, withDecider: true }).catch((): WorkItemView[] => []),
        getGovernance().catch(() => null),
        listStaff().catch((): Staff[] => []),
        listMembers().catch(() => []),
      ])
  const { thread, workItemModules } = await speakAsDepartmentAgents(messages, agents)
  // Command cards (owner / manager only: RLS returns nothing for staff, and nothing before the table exists).
  const candidates = await listCommandCandidates(await supabaseServer()).catch(() => [])
  const exceptions = exceptionRows.filter((i) => !i.hasApprovalCard)
  const decidedExceptions = recentItems.filter((i) => !i.hasApprovalCard && i.decided_path === "human").slice(0, 12)
  const pendingDecisions = governance?.pendingDecisions ?? pending.length + exceptions.length
  const nowIso = new Date().toISOString()
  const leadNames = Object.fromEntries(leads.map((l) => [l.id, l.contact_name]))
  const customers = leads.slice(0, RECENT_CUSTOMERS).map((l) => ({ id: l.id, name: l.contact_name, preview: l.next_action ?? l.need ?? null, at: l.created_at }))

  // Office is a full-bleed workspace: no page inset, the messenger reaches the sidebar seam, the window edge and the bottom.
  return (
    <OfficeMessenger
      workspaceId={session.workspace.id}
      workspaceName={session.workspace.name}
      userName={session.userName}
      avatarUrl={session.avatarUrl ?? null}
      initialMessages={thread}
      agents={agents}
      pending={pending}
      decided={decided}
      exceptions={exceptions}
      decidedExceptions={decidedExceptions}
      members={members}
      staff={staffRows}
      pendingDecisions={pendingDecisions}
      tasks={responsibilities}
      customers={customers}
      leadNames={leadNames}
      candidates={candidates}
      workItemModules={workItemModules}
      nowIso={nowIso}
    />
  )
}

export default ChatPage

/**
 * Lines the engine wrote as "NIVO" before work-item lines spoke as their department's agent: each one tied to a work item is shown
 * as that department's installed agent (Sales, Accounting, Chatbot). Anything else stays a NIVO Core line.
 */
const speakAsDepartmentAgents = async (
  messages: ReadonlyArray<Message>,
  agents: ReadonlyArray<Agent>,
): Promise<{ thread: ReadonlyArray<Message>; workItemModules: Record<string, string> }> => {
  const ids = [...new Set(messages.filter((m) => m.agent_id === null && m.author_kind === "system" && m.work_item_id).map((m) => m.work_item_id as string))]
  if (ids.length === 0) return { thread: messages, workItemModules: {} }
  const { data } = await (await supabaseServer()).from("work_items").select("id, department").in("id", ids)
  const departmentOf = new Map(((data ?? []) as Array<{ id: string; department: string }>).map((w) => [w.id, w.department]))
  const agentOf = new Map<string, Agent>(agents.filter((a) => a.status === "active").map((a) => [a.module, a]))
  // The work item's department is where its workbench lives: command mirror lines link to /m/<department>/workbench?focus=<id>.
  const workItemModules = Object.fromEntries(departmentOf)
  const thread = messages.map((m): Message => {
    const agent = m.agent_id === null && m.author_kind === "system" && m.author_name !== COMMAND_LINE_AUTHOR && m.work_item_id ? agentOf.get(departmentOf.get(m.work_item_id) ?? "") : undefined
    return agent ? { ...m, author_kind: "agent", author_name: agent.name, agent_id: agent.id } : m
  })
  return { thread, workItemModules }
}

/** OpenClaw writes the text (setup chat, Office replies, classification), so these screens may wait longer than the platform default. */
export const maxDuration = 60;
