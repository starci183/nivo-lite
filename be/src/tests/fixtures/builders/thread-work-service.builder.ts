import type { ActionEntry } from "@modules/domain/decisions"
import type { ThreadMessage } from "@modules/domain/thread-messages"
/** An agent as the thread work reads it from the agent directory. */
interface WorkAgentRow {
    id: string
    name: string
    module: string
    can_tag_agent_ids: Array<string>
}

/** A customer as the thread work names it. */
interface WorkLeadRow {
    id: string
    contact_name: string
}

/** A member as a decider. */
interface DeciderRow {
    id: string
    display_name: string
    role: "owner" | "manager" | "staff"
}

/** One piece of thread work as the runtime reads it. */
interface ThreadWorkRow {
    id: string
    workspace_id: string
    thread_id: string
    work_item_id: string
    agent_id: string
    state: "running" | "asked" | "waiting_member" | "done" | "stopped"
    approval_request_id: string | null
    waiting_member_id: string | null
    missing_fields: Array<string>
}

/** Asking work with how its request ended. */
interface SettledAskRow extends ThreadWorkRow {
    request_status: "approved" | "rejected" | "expired"
    resolved_by: string | null
}

export const SALES_ROW: WorkAgentRow = {
    id: "agent-sales",
    name: "AI Sales",
    module: "sales",
    can_tag_agent_ids: ["agent-accounting"],
}
export const SALES_AI = { id: "agent-sales", name: "AI Sales", module: "sales", canTag: ["agent-accounting"] }
export const LEAD: WorkLeadRow = { id: "lead-thao", contact_name: "Chi Thao" }
export const MINH: DeciderRow = { id: "m-minh", display_name: "Anh Minh", role: "manager" }

export const DISCOUNT: ActionEntry = {
    action: "give_discount",
    moduleKey: "sales",
    maxMode: null,
    next: [],
    label: { vi: "Giam gia", en: "Give discount" },
}

/** A piece of thread work waiting for a member, with the fields a spec changes overridden. */
export const workRow = (overrides: Partial<ThreadWorkRow> = {}): ThreadWorkRow => ({
    id: "work-1",
    workspace_id: "ws-1",
    thread_id: "thread-1",
    work_item_id: "item-1",
    agent_id: "agent-sales",
    state: "waiting_member",
    approval_request_id: null,
    waiting_member_id: "m-van",
    missing_fields: ["tax_code"],
    ...overrides,
})

/** Asking work whose approval request was approved by the manager, with the fields a spec changes overridden. */
export const settledRow = (overrides: Partial<SettledAskRow> = {}): SettledAskRow => ({
    ...workRow({ state: "asked", approval_request_id: "req-1", waiting_member_id: null, missing_fields: [] }),
    request_status: "approved",
    resolved_by: "m-minh",
    ...overrides,
})

export const MESSAGE: ThreadMessage = {
    id: "msg-1",
    threadId: "thread-1",
    authorKind: "member",
    authorId: "m-van",
    authorName: "Van",
    authorRole: "staff",
    body: "0312345678",
    quoted: [],
    mentions: [],
    approval: null,
    createdAt: "2026-10-22T09:44:00.000Z",
}

export const CARDED: ThreadMessage = {
    ...MESSAGE,
    approval: {
        requestId: "req-1",
        action: "Giam gia 8%",
        amount: 8,
        unit: "percent",
        rule: "Giam gia",
        policy: "any",
        expiresAt: "2026-10-22T10:11:00.000Z",
        approvers: [],
        excluded: [],
        outcome: "approved",
        decidedBy: "m-minh",
        decidedByName: "Anh Minh",
        decidedAt: "2026-10-22T09:42:00.000Z",
        owner: null,
    },
}

/** What the agent directory answers for an agent row. */
export const agentFoundOf = (row: WorkAgentRow | undefined) =>
    row === undefined ? null : { id: row.id, name: row.name, module: row.module, canTagAgentIds: row.can_tag_agent_ids }

/** What the lead reader answers for a lead row. */
export const leadCardsOf = (row: WorkLeadRow | undefined) =>
    row === undefined
        ? []
        : [{ id: row.id, contactName: row.contact_name, company: "", channel: "", stage: "new", email: null }]

/** What the member directory answers for a decider row. */
export const memberFoundOf = (row: DeciderRow | undefined) =>
    row === undefined ? null : { id: row.id, displayName: row.display_name, role: row.role }

/** How the approval reads answer for settled asking work. */
export const settledRequestsOf = (rows: ReadonlyArray<SettledAskRow>) =>
    rows.map((row) => ({ id: row.approval_request_id ?? "", status: row.request_status, resolvedBy: row.resolved_by }))
