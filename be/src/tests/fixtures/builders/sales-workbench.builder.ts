import type { ContractResult } from "@modules/domain/contracts"
import type {
    SalesDeal,
    AutoActivity,
    SalesDecision,
    AttentionRow,
    WorkItemView,
    SalesRows,
} from "@modules/domain/sales-workbench"
import { builder, mock } from "@starci/jest-preset"
import type { LeadView } from "@modules/domain/leads"
import type { OrdersWorkbenchRow } from "@modules/domain/orders"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"

const CREATED = "2026-10-12T10:00:00.000Z"
const UPDATED = "2026-10-12T11:00:00.000Z"
/** A lead creation instant before the workbench day. */
export const OLDER = "2026-10-11T00:00:00.000Z"
/** The prior sales reporting day. */
export const YESTERDAY = "2026-10-12T00:00:00.000Z"
/** The final millisecond before the local reporting month. */
export const BEFORE_MONTH = "2026-10-31T16:59:59.999Z"
/** The start of the local reporting month. */
export const MONTH = "2026-10-31T17:00:00.000Z"
/** A timestamp inside the local reporting month. */
export const NOVEMBER = "2026-11-01T00:00:00.000Z"
/** The fixed workbench clock. */
export const NOW = "2026-10-13T02:00:00.000Z"
/** Builds quote proposal fields for work-item scenarios. */
export const quote = (amount_vnd?: number | null, summary = "Quote") => ({ summary, fields: {}, amount_vnd })
/** The expected clipped preview including its ellipsis. */
export const CLIPPED = "x".repeat(139) + "\u2026"
const contact = { id: "lead-1", contact_name: "Lan", company: "Tea Co", channel: "web" }
/** Builds the sales lead shared by workbench scenarios. */
export const leadOf = builder<LeadView>(
    mock<LeadView>({ ...contact, need: "Tea", stage: "proposal", created_at: CREATED }),
)
/** Builds a confirmed order for the scenario lead. */
export const orderOf = builder<OrdersWorkbenchRow>(
    mock<OrdersWorkbenchRow>({
        id: "order-1",
        lead_id: "lead-1",
        order_no: "ORD-1",
        items: "Tea",
        amount_vnd: 200,
        status: "confirmed",
        confirmed_at: UPDATED,
        shipped_at: null,
        carrier: null,
        tracking_code: null,
    }),
)
/** Builds an open sales responsibility. */
export const stepOf = builder<ResponsibilityRecord>(
    mock<ResponsibilityRecord>({
        id: "step-1",
        lead_id: "lead-1",
        title: "Follow up",
        owner_name: "Mai",
        next_action: "Call",
        due_at: null,
        status: "open",
    }),
)
/** Builds a completed automatic sales work item. */
export const itemOf = builder<WorkItemView>(
    mock<WorkItemView>({
        id: "item-1",
        department: "sales",
        action: "send_quote",
        subject_id: "lead-1",
        lead_id: "lead-1",
        status: "done",
        decided_path: "auto",
        reason: "routine",
        missing_fields: [],
        proposal: quote(100),
        result: null,
        error: null,
        evidence_state: "verified",
        assigned_staff_id: null,
        created_at: CREATED,
        updated_at: UPDATED,
        completed_at: null,
        lead: contact,
        assignedStaffName: null,
        href: "/leads/lead-1",
    }),
)
/** Builds empty workbench inputs with a fixed clock and explicit scenario overrides. */
export const rowsOf = builder<SalesRows>({
    nowMs: Date.parse(NOW),
    leads: [],
    steps: [],
    orders: [],
    invoices: [],
    conversations: [],
    messages: [],
    drafts: [],
    staff: [],
    outcomes: [],
    items: [],
    decided: [],
    autoEvidence: [],
    contracts: [],
    isTestRun: () => false,
})
/** Builds an active monthly sales contract. */
export const contractOf = builder<ContractResult>({
    id: "contract-1",
    leadId: "lead-1",
    customerName: "Lan",
    plan: "Monthly",
    startsOn: "2026-10-01",
    endsOn: "2026-11-01",
    amountVnd: 100,
    status: "active",
    note: "Renew",
})
/** Builds the expected sales deal view. */
export const dealOf = builder<SalesDeal>({
    leadId: "lead-1",
    customer: "Lan",
    company: "Tea Co",
    channel: "web",
    need: "Tea",
    stage: "proposal",
    valueVnd: null,
    valueSource: null,
    nextStep: null,
    dueAt: null,
    owner: null,
    createdAt: CREATED,
    closedReason: null,
    closedAt: null,
})
/** Builds the expected automatic activity view. */
export const activityOf = builder<AutoActivity>({
    id: "result",
    action: "send_quote",
    leadId: "lead-1",
    customer: "Lan",
    summary: "Quote",
    at: UPDATED,
    evidenceState: "verified",
    evidence: null,
    href: "/leads/lead-1",
})
/** Builds the expected pending decision view. */
export const decisionOf = builder<SalesDecision>({
    id: "legacy",
    source: "work_item",
    workItemId: null,
    executionId: null,
    leadId: null,
    customer: "\u2014",
    action: "follow_up",
    reason: "routine",
    summary: "Call",
    draft: "",
    amountVnd: null,
    hasAmount: false,
    missing: [],
    assignedStaffId: null,
    assignedStaffName: null,
    createdAt: CREATED,
})
/** Builds the expected attention view. */
export const attentionOf = builder<AttentionRow>({
    key: "decision:waiting",
    kind: "decision",
    leadId: "lead-1",
    customer: "Lan",
    company: "Tea Co",
    stage: "proposal",
    need: "Quote",
    since: CREATED,
    owner: null,
    workItemId: null,
    decisionId: null,
    action: "send_quote",
    missing: [],
})
/** Builds failed-item attention. */
export const failureOf = builder<AttentionRow>(attentionOf({ kind: "failed", since: UPDATED }))
/** Builds overdue-responsibility attention. */
export const overdueOf = builder<AttentionRow>(
    attentionOf({ kind: "overdue", since: YESTERDAY, owner: "Mai", action: null }),
)
/** Builds attention for an unanswered customer message. */
export const replyOf = builder<AttentionRow>(
    attentionOf({ kind: "awaiting_reply", since: "2026-10-13T01:56:00.000Z", action: null }),
)
/** Builds attention without a linked lead. */
export const anonymousOf = builder<AttentionRow>(
    attentionOf({ leadId: null, customer: "\u2014", company: "", stage: null }),
)
/** Builds failed-item attention without a linked lead. */
export const unknownFailureOf = builder<AttentionRow>(anonymousOf({ kind: "failed", since: UPDATED }))
/** Builds the expected legacy execution decision. */
export const legacyOf = builder<SalesDecision>(decisionOf({ source: "execution", reason: null, createdAt: NOW }))
