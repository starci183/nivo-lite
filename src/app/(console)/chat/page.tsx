import { PageContainer } from "@starci/grammar/common"
import { OfficeMessenger } from "@/features/office"
import { hydrate, listDecidedApprovals, listPendingApprovals, type Embedded } from "@/features/office/queries"
import { listExceptions, listWorkItems, getGovernance, governanceFrom, listStaff, workViewsFrom } from "@/lib/flow-queries"
import type { Staff, WorkItemView } from "@/lib/flow-types"
import { leadRowsFrom, listAgents, listLeads, listMessages, listResponsibilities } from "@/lib/queries"
import { listMembers, memberListingsFrom } from "@/lib/members"
import { getOfficeData } from "@/lib/page-data"
import { getSession } from "@/lib/session"

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
  const exceptions = exceptionRows.filter((i) => !i.hasApprovalCard)
  const decidedExceptions = recentItems.filter((i) => !i.hasApprovalCard && i.decided_path === "human").slice(0, 12)
  const pendingDecisions = governance?.pendingDecisions ?? pending.length + exceptions.length
  const nowIso = new Date().toISOString()
  const leadNames = Object.fromEntries(leads.map((l) => [l.id, l.contact_name]))
  const customers = leads.slice(0, RECENT_CUSTOMERS).map((l) => ({ id: l.id, name: l.contact_name, preview: l.next_action ?? l.need ?? null, at: l.created_at }))

  return (
    <PageContainer measure="full">
      <OfficeMessenger
        workspaceId={session.workspace.id}
        workspaceName={session.workspace.name}
        userName={session.userName}
        avatarUrl={session.avatarUrl ?? null}
        initialMessages={messages}
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
        nowIso={nowIso}
      />
    </PageContainer>
  )
}

export default ChatPage

/** OpenClaw writes the text (setup chat, Office replies, classification), so these screens may wait longer than the platform default. */
export const maxDuration = 60;
