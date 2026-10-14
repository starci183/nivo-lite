import type { ContractResult } from "@modules/domain/contracts"
import type { SalesDeal, AutoActivity, SalesDecision, AttentionRow } from "./sales-workbench.contracts"
import { builder, mock } from "@starci/jest-preset"
import type { LeadView } from "@modules/domain/leads"
import type { OrdersWorkbenchRow } from "@modules/domain/orders"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import type { WorkItemView } from "./work-item-view.contracts"
import { autoDoneItemsOf, buildSalesWorkbench, conversationIdsOf, type SalesRows } from "./sales-workbench.mapper"

const CREATED = "2026-10-12T10:00:00.000Z"
const UPDATED = "2026-10-12T11:00:00.000Z"
const OLDER = "2026-10-11T00:00:00.000Z"
const YESTERDAY = "2026-10-12T00:00:00.000Z"
const BEFORE_MONTH = "2026-10-31T16:59:59.999Z"
const MONTH = "2026-10-31T17:00:00.000Z"
const NOVEMBER = "2026-11-01T00:00:00.000Z"
const NOW = "2026-10-13T02:00:00.000Z"
const quote = (amount_vnd?: number | null, summary = "Quote") => ({ summary, fields: {}, amount_vnd })
const CLIPPED = "x".repeat(139) + "\u2026"

const contact = { id: "lead-1", contact_name: "Lan", company: "Tea Co", channel: "web" }
const leadOfSeed = mock<LeadView>({ ...contact, need: "Tea", stage: "proposal", created_at: CREATED })
const leadOf = builder<LeadView>(leadOfSeed)
const orderOfSeed = mock<OrdersWorkbenchRow>({
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
})
const orderOf = builder<OrdersWorkbenchRow>(orderOfSeed)
const stepOfSeed = mock<ResponsibilityRecord>({
    id: "step-1",
    lead_id: "lead-1",
    title: "Follow up",
    owner_name: "Mai",
    next_action: "Call",
    due_at: null,
    status: "open",
})
const stepOf = builder<ResponsibilityRecord>(stepOfSeed)
const itemOfSeed = mock<WorkItemView>({
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
})
const itemOf = builder<WorkItemView>(itemOfSeed)
const rowsOf = builder<SalesRows>({
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

const contractOf = builder<ContractResult>({
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
const dealOf = builder<SalesDeal>({
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
const activityOf = builder<AutoActivity>({
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
const decisionOf = builder<SalesDecision>({
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
const attentionOf = builder<AttentionRow>({
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

const failureOf = builder<AttentionRow>(attentionOf({ kind: "failed", since: UPDATED }))

const overdueOf = builder<AttentionRow>(attentionOf({ kind: "overdue", since: YESTERDAY, owner: "Mai", action: null }))
const replyOf = builder<AttentionRow>(
    attentionOf({ kind: "awaiting_reply", since: "2026-10-13T01:56:00.000Z", action: null }),
)
const anonymousOf = builder<AttentionRow>(attentionOf({ leadId: null, customer: "\u2014", company: "", stage: null }))
const unknownFailureOf = builder<AttentionRow>(anonymousOf({ kind: "failed", since: UPDATED }))
const legacyOf = builder<SalesDecision>(decisionOf({ source: "execution", reason: null, createdAt: NOW }))

type PendingCase = Pick<SalesDecision, "customer" | "amountVnd" | "hasAmount" | "missing" | "draft"> &
    Pick<AttentionRow, "leadId" | "owner" | "kind"> &
    Record<"label" | "action" | "attentionAction", string> &
    Record<"staffName", string | null> & {
        named: boolean
        field: string | number | null
        amount: number | null | undefined
    }
type LegacyCase = Pick<SalesDecision, "leadId" | "customer" | "summary"> & {
    label: string
    step: ResponsibilityRecord | null
}

const benchOf = (changes: Partial<SalesRows> = {}) => buildSalesWorkbench(rowsOf(changes))

it("keeps conversation order and the first forty automatic completed sales items", () => {
    const automatic = Array.from({ length: 41 }, (_, index) => itemOf({ id: `auto-${index}` }))
    expect(
        autoDoneItemsOf([
            itemOf({ department: "accounting" }),
            itemOf({ status: "queued" }),
            itemOf({ decided_path: "human" }),
            ...automatic,
        ]),
    ).toEqual(automatic.slice(0, 40))
})

it("maps first-row deal lookups and measures exact monthly and conversion boundaries", () => {
    const now = Date.parse("2026-10-31T18:00:00.000Z")
    const since = new Date(now - 90 * 86_400_000).toISOString()
    const beforeSince = new Date(Date.parse(since) - 1).toISOString()
    const result = benchOf({
        nowMs: now,
        leads: [
            leadOf({ id: "won", stage: "won", channel: "zalo", created_at: since }),
            leadOf({ id: "no-amount", stage: "won", channel: "zalo" }),
            leadOf({ id: "outcome", stage: "won" }),
            leadOf(),
            leadOf({ id: "empty", stage: "new", channel: "" }),
            leadOf({ id: "quote", stage: "qualified", channel: "other" }),
            leadOf({ id: "null-order", created_at: beforeSince }),
            leadOf({ id: "test", contact_name: "UAT", company: "Debug" }),
            leadOf({ id: "lost", stage: "lost" }),
            leadOf({ id: "lost-old", stage: "lost", created_at: OLDER }),
        ],
        steps: [
            stepOf(),
            stepOf({ id: "later", next_action: "Ignored", owner_name: "Ignored" }),
            stepOf({ id: "quote-step", lead_id: "quote", next_action: "", owner_name: "Step owner" }),
        ],
        orders: [
            orderOf({ id: "cancelled", status: "cancelled", amount_vnd: 999 }),
            orderOf({ lead_id: "won", confirmed_at: MONTH, amount_vnd: 900 }),
            orderOf({ id: "zero", lead_id: "no-amount", confirmed_at: MONTH, amount_vnd: null }),
            orderOf({ id: "old", lead_id: "won", confirmed_at: BEFORE_MONTH, amount_vnd: 1000 }),
            orderOf({ id: "unconfirmed", confirmed_at: null }),
            orderOf({ id: "older", amount_vnd: 999 }),
            orderOf({ id: "anonymous", lead_id: null, confirmed_at: NOVEMBER }),
            orderOf({ id: "missing", lead_id: "missing", confirmed_at: NOVEMBER }),
            orderOf({ id: "open", confirmed_at: NOVEMBER }),
            orderOf({ id: "null", lead_id: "null-order", amount_vnd: null }),
        ],
        items: [
            itemOf({ status: "waiting_decision", assignedStaffName: "Assigned" }),
            itemOf({ id: "q1", lead_id: "quote", status: "waiting_decision", proposal: quote(50, "Offer") }),
            itemOf({ id: "q2", lead_id: "quote", status: "waiting_decision" }),
            itemOf({ id: "rejected", lead_id: "empty", status: "rejected" }),
            itemOf({ id: "no-amount", lead_id: "empty", proposal: quote(undefined, "Empty") }),
            itemOf({ id: "no-lead", lead_id: null }),
            itemOf({ id: "other", lead_id: "empty", action: "follow_up" }),
            itemOf({ id: "nq", lead_id: "null-order", proposal: quote(80) }),
        ],
        outcomes: [
            { lead_id: "outcome", evidence: "Won", created_at: MONTH },
            { lead_id: "won", evidence: "Old", created_at: BEFORE_MONTH },
            { lead_id: "won", evidence: "Ignored", created_at: OLDER },
            { lead_id: null, evidence: null, created_at: NOVEMBER },
            { lead_id: "missing", evidence: null, created_at: NOVEMBER },
            { lead_id: "lead-1", evidence: null, created_at: NOVEMBER },
            { lead_id: "lost", evidence: null, created_at: NOW },
        ],
        isTestRun: (...names) => names.includes("UAT") || names.includes("Debug"),
    })
    expect(result.deals[0]).toEqual(
        dealOf({ valueVnd: 200, valueSource: "order", nextStep: "Call", owner: "Assigned" }),
    )
    expect(
        result.deals.map((deal) => [deal.leadId, deal.valueVnd, deal.valueSource, deal.closedReason, deal.closedAt]),
    ).toEqual([
        ["lead-1", 200, "order", null, null],
        ["empty", null, null, null, null],
        ["quote", 50, "quote", null, null],
        ["null-order", 80, "quote", null, null],
        ["test", null, null, null, null],
        ["outcome", null, null, "Won", MONTH],
        ["won", 900, "order", "Old", BEFORE_MONTH],
        ["no-amount", null, null, null, null],
        ["lost", null, null, null, NOW],
        ["lost-old", null, null, null, null],
    ])
    expect([result.deals[2]?.nextStep, result.deals[2]?.owner]).toEqual(["Offer", "Step owner"])
    expect([result.deals[1]?.nextStep, result.deals[1]?.dueAt, result.deals[1]?.owner]).toEqual([null, null, null])
    expect([result.deals[4]?.customer, result.deals[4]?.company]).toEqual(["UAT", "Debug"])
    expect(result.deals[6]?.createdAt).toBe(since)
    expect(result.deals[1]?.channel).toBe("")
    expect(result.metrics).toEqual({
        openCount: 5,
        proposalValueVnd: 280,
        proposalCount: 3,
        wonCount: 3,
        wonValueVnd: 900,
        waitingCount: 3,
        conversion: {
            windowDays: 90,
            leads: 8,
            won: 3,
            sources: [
                { source: "web", leads: 4, won: 1 },
                { source: "zalo", leads: 2, won: 2 },
                { source: "other", leads: 2, won: 0 },
            ],
        },
    })
})

it("maps automatic activity using the first evidence, result and completion fallbacks", () => {
    const result = benchOf({
        items: [
            itemOf({ id: "result", result: { summary: "Sent", href: "/sent" }, completed_at: NOW }),
            itemOf({ id: "fallback", result: { summary: "Finished" }, lead: null }),
            itemOf({ id: "empty-evidence" }),
            itemOf({ id: "missing-evidence", lead: null }),
        ],
        autoEvidence: [
            { work_item_id: null, evidence: "Ignore" },
            { work_item_id: "result", evidence: "Newest" },
            { work_item_id: "result", evidence: "Older" },
            { work_item_id: "fallback", evidence: null },
            { work_item_id: "empty-evidence", evidence: "" },
        ],
    })
    expect(result.activity).toEqual([
        activityOf({ summary: "Sent", at: NOW, evidence: "Newest", href: "/sent" }),
        activityOf({ summary: "Finished", id: "fallback", customer: null }),
        activityOf({ id: "empty-evidence" }),
        activityOf({ id: "missing-evidence", customer: null }),
    ])
})

it.each`
    label          | leadId       | named    | field         | customer      | amount       | amountVnd | hasAmount | missing           | draft         | staffName     | owner         | action          | kind          | attentionAction
    ${"named"}     | ${"lead-1"}  | ${true}  | ${null}       | ${"Lan"}      | ${100}       | ${100}    | ${true}   | ${[]}             | ${"Dear Lan"} | ${"Assigned"} | ${"Assigned"} | ${"send_quote"} | ${"decision"} | ${"send_quote"}
    ${"numeric"}   | ${"missing"} | ${false} | ${42}         | ${"42"}       | ${null}      | ${null}   | ${true}   | ${[]}             | ${""}         | ${null}       | ${null}       | ${"send_quote"} | ${"decision"} | ${"send_quote"}
    ${"string"}    | ${null}      | ${false} | ${"Customer"} | ${"Customer"} | ${undefined} | ${null}   | ${true}   | ${["amount_vnd"]} | ${""}         | ${null}       | ${null}       | ${"follow_up"}  | ${"clarify"}  | ${"send_follow_up"}
    ${"anonymous"} | ${null}      | ${false} | ${null}       | ${"\u2014"}   | ${undefined} | ${null}   | ${false}  | ${[]}             | ${""}         | ${null}       | ${null}       | ${"send_quote"} | ${"decision"} | ${"send_quote"}
`("maps a $label waiting proposal and its attention row", (data: PendingCase) => {
    const { leadId, customer, action, draft, amountVnd, hasAmount, missing, staffName } = data
    const { named, field, amount, kind, attentionAction, owner } = data
    const staffId = staffName === null ? null : "staff-1"
    const assignment = { assigned_staff_id: staffId, assignedStaffName: staffName }
    const assigned = { assignedStaffId: staffId, assignedStaffName: staffName }
    const proposal = { ...quote(amount), fields: { customer: field }, draft: draft || undefined }
    const input = itemOf({
        status: "waiting_decision",
        lead_id: leadId,
        lead: named ? itemOf().lead : null,
        action,
        missing_fields: missing,
        proposal,
        ...assignment,
    })
    const result = benchOf({ leads: named ? [leadOf()] : [], items: [input] })
    const identity = { id: "item-1", workItemId: "item-1", summary: "Quote" }
    const details = { leadId, customer, action, draft, amountVnd, hasAmount, missing }
    expect(result.decisions).toEqual([decisionOf({ ...identity, ...details, ...assigned })])
    const expected = named ? attentionOf : anonymousOf
    const work = { key: "decision:item-1", workItemId: "item-1", decisionId: "item-1" }
    expect(result.attention).toEqual([
        expected({ ...work, kind, leadId, customer, owner, action: attentionAction, missing }),
    ])
    expect(result.metrics.waitingCount).toBe(1)
})

it.each`
    label                 | step                              | leadId      | customer    | summary
    ${"linked"}           | ${stepOf()}                       | ${"lead-1"} | ${"Lan"}    | ${"Call"}
    ${"missing step"}     | ${null}                           | ${null}     | ${"\u2014"} | ${""}
    ${"missing customer"} | ${stepOf({ lead_id: "missing" })} | ${null}     | ${"\u2014"} | ${"Call"}
`("maps a legacy draft with $label", (data: LegacyCase) => {
    const result = benchOf({
        leads: [leadOf()],
        steps: data.step === null ? [] : [data.step],
        drafts: [{ id: "legacy", responsibility_id: "step-1", draft: "Legacy text", created_at: NOW }],
    })
    expect(result.decisions).toEqual([
        legacyOf({
            executionId: "legacy",
            leadId: data.leadId,
            customer: data.customer,
            summary: data.summary,
            draft: "Legacy text",
        }),
    ])
})

it("orders legacy and work decisions by their creation time", () => {
    const result = benchOf({
        items: [itemOf({ id: "late", status: "waiting_decision", created_at: NOW })],
        drafts: [{ id: "legacy", responsibility_id: "gone", draft: "D", created_at: OLDER }],
    })
    expect(result.decisions.map(({ id, createdAt }) => ({ id, createdAt }))).toEqual([
        { id: "legacy", createdAt: OLDER },
        { id: "late", createdAt: NOW },
    ])
})

it("orders failures before overdue work, clips long text, and filters ineligible responsibilities", () => {
    const longText = `  ${"x".repeat(139)}  trailing\n words  `
    const result = benchOf({
        leads: [leadOf(), leadOf({ id: "won", stage: "won" })],
        items: [
            itemOf({ id: "error", status: "failed", error: longText, assignedStaffName: "Assigned" }),
            itemOf({ id: "summary", status: "failed", error: "", proposal: quote(undefined, "  Try\n again  ") }),
            itemOf({ id: "unknown", lead_id: "unowned", lead: null, status: "failed", error: null }),
            itemOf({ id: "no-lead", lead_id: null, lead: null, status: "failed" }),
            itemOf({ department: "inventory", status: "failed" }),
            itemOf({ status: "queued" }),
        ],
        steps: [
            stepOf({ due_at: YESTERDAY }),
            stepOf({ id: "title", next_action: "", title: longText, due_at: OLDER }),
            stepOf({ id: "unknown", lead_id: "missing", due_at: YESTERDAY }),
            stepOf({ id: "closed", lead_id: "won", due_at: YESTERDAY }),
            stepOf({ id: "undated", due_at: null }),
            stepOf({ id: "future", due_at: NOW }),
            stepOf({ id: "approval", due_at: YESTERDAY, status: "waiting_approval" }),
        ],
    })

    expect(result.attention).toEqual([
        failureOf({ key: "failed:error", need: CLIPPED, owner: "Assigned", workItemId: "error" }),
        failureOf({ key: "failed:summary", need: "Try again", owner: "Mai", workItemId: "summary" }),
        unknownFailureOf({ key: "failed:unknown", leadId: "unowned", workItemId: "unknown" }),
        unknownFailureOf({ key: "failed:no-lead", leadId: null, workItemId: "no-lead" }),
        overdueOf({ key: "overdue:title", need: CLIPPED, since: OLDER }),
        overdueOf({ key: "overdue:step-1", need: "Call" }),
    ])
})

it("flags one unanswered customer conversation per open lead after three minutes using the newest message", () => {
    const old = "2026-10-13T01:56:00.000Z"
    const boundary = "2026-10-13T01:57:00.000Z"
    const conversations = [
        { id: "none", lead_id: "lead-1", handled_by: null },
        { id: "assistant", lead_id: "lead-1", handled_by: null },
        { id: "no-lead", lead_id: null, handled_by: null },
        { id: "unknown", lead_id: "missing", handled_by: null },
        { id: "closed", lead_id: "won", handled_by: null },
        { id: "recent", lead_id: "recent", handled_by: null },
        { id: "handled", lead_id: "lead-1", handled_by: "Handler" },
        { id: "duplicate", lead_id: "lead-1", handled_by: "Other" },
        { id: "step", lead_id: "step", handled_by: null },
        { id: "unowned", lead_id: "unowned", handled_by: null },
    ]
    expect(conversationIdsOf(conversations.slice(0, 2))).toEqual(["none", "assistant"])
    const result = benchOf({
        leads: [
            leadOf(),
            leadOf({ id: "step" }),
            leadOf({ id: "unowned" }),
            leadOf({ id: "won", stage: "won" }),
            leadOf({ id: "recent" }),
        ],
        steps: [stepOf({ lead_id: "step" })],
        conversations: conversations,
        messages: [
            { conversation_id: "assistant", role: "assistant", body: "Answered", created_at: old },
            { conversation_id: "assistant", role: "user", body: "Older question", created_at: YESTERDAY },
            { conversation_id: "no-lead", role: "user", body: "Unknown", created_at: old },
            { conversation_id: "unknown", role: "user", body: "Unknown", created_at: old },
            { conversation_id: "closed", role: "user", body: "Closed", created_at: old },
            { conversation_id: "recent", role: "user", body: "Recent", created_at: "2026-10-13T01:57:00.001Z" },
            { conversation_id: "handled", role: "user", body: "  Need\n tea  ", created_at: boundary },
            { conversation_id: "duplicate", role: "user", body: "Duplicate", created_at: old },
            { conversation_id: "step", role: "user", body: "Call me", created_at: old },
            { conversation_id: "unowned", role: "user", body: "Help", created_at: old },
        ],
    })

    expect(result.attention).toEqual([
        replyOf({ key: "reply:step", leadId: "step", need: "Call me", owner: "Mai" }),
        replyOf({ key: "reply:unowned", leadId: "unowned", need: "Help" }),
        replyOf({ key: "reply:handled", need: "Need tea", owner: "Handler", since: boundary }),
    ])
})

it("sorts active contracts first by expiry without mutating input and retains staff", () => {
    const contracts = [
        contractOf({ id: "ended", status: "ended", endsOn: "2026-01-01" }),
        contractOf({ id: "active-later", endsOn: "2026-12-01" }),
        contractOf({ id: "active-earlier" }),
        contractOf({ id: "cancelled", status: "cancelled", endsOn: "2026-02-01" }),
    ]
    const closed = Array.from({ length: 18 }, (_, index) =>
        leadOf({ id: String(index), stage: index < 9 ? "won" : "lost" }),
    )
    const leads = [
        leadOf(),
        leadOf({ id: "empty", company: "" }),
        leadOf({ id: "placeholder", company: "\u2014" }),
        ...closed,
        ...Array.from({ length: 180 }, (_, index) => leadOf({ id: `open-${index}` })),
    ]
    const before = contracts.map((contract) => ({ ...contract }))
    const result = benchOf({ leads, contracts, staff: [{ id: "staff-1", name: "Mai" }] })
    expect(result.contracts).toEqual([contracts[2], contracts[1], contracts[0], contracts[3]])
    expect(contracts).toEqual(before)
    expect(result.staff).toEqual([{ id: "staff-1", name: "Mai" }])
    expect(result.deals.filter((deal) => ["won", "lost"].includes(deal.stage)).map((deal) => deal.leadId)).toEqual(
        Array.from({ length: 16 }, (_, index) => String(index < 8 ? index : index + 1)),
    )
    expect(result.closedHidden).toEqual({ won: 1, lost: 1 })
    expect(result.leadOptions).toEqual(
        leads.slice(0, 200).map((lead, index) => ({
            id: lead.id,
            name: index === 1 || index === 2 ? "Lan" : "Lan \u00b7 Tea Co",
        })),
    )
    expect(result.leadOptions).toHaveLength(200)
})
