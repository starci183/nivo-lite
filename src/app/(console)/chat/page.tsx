import { PageContainer } from "@starci/grammar/common"
import { OfficeMessenger } from "@/features/office"
import { listDecidedApprovals, listPendingApprovals } from "@/features/office/queries"
import { listExceptions, listWorkItems, getGovernance, listStaff } from "@/lib/flow-queries"
import type { Staff, WorkItemView } from "@/lib/flow-types"
import { listAgents, listLeads, listMessages, listResponsibilities } from "@/lib/queries"
import { listMembers } from "@/lib/members"
import { getSession } from "@/lib/session"

/** Always render fresh: messages and approvals change constantly. */
export const dynamic = "force-dynamic"

const RECENT_CUSTOMERS = 5

/** Office: the team messenger with agents, approvals inside the thread, and team tasks. */
const ChatPage = async () => {
  const [session, messages, agents, responsibilities, pending, decided, leads, exceptionRows, recentItems, governance, staffRows, _members] = await Promise.all([
    getSession(),
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
    listMembers().catch(() => []), // warms the per-request cache the messenger wrapper reads
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
