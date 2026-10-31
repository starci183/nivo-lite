import { quotesByLeadOf } from "./sales-quotes.mapper"
import type { ContractResult } from "@modules/domain/contracts"
import type { LeadDecisionRecord as DecisionRow } from "@modules/domain/decisions"
import type { InvoiceViewRow as Invoice } from "@modules/domain/invoices"
import type { OrdersWorkbenchRow as Order } from "@modules/domain/orders"
import type { LeadView as LeadRecord } from "@modules/domain/leads"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import type { WorkItemView } from "./work-item-view.contracts"
import { handoffsOf } from "./sales-handoffs.mapper"
import { conversationByLeadOf, conversationOf } from "./sales-conversations.mapper"
import type {
    TestRunName,
    AttentionKind,
    AttentionRow,
    AutoActivity,
    SalesConversion,
    SalesDeal,
    SalesDecision,
    SalesMetrics,
    SalesWorkbenchData,
} from "./sales-workbench.contracts"

/** A customer conversation the workbench watches for an unanswered message. */
export interface ConversationSlim {
    /** The record id. */
    readonly id: string
    /** The linked customer, when one is known. */
    readonly lead_id: string | null
    /** The person holding this customer conversation. */
    readonly handled_by: string | null
}

/** One message of such a conversation. */
export interface MessageSlim {
    /** The conversation this message belongs to. */
    readonly conversation_id: string
    /** Who wrote this message. */
    readonly role: string
    /** The message text. */
    readonly body: string
    /** When the record was created, as ISO text. */
    readonly created_at: string
}

/** A legacy draft still waiting for approval. */
export interface DraftSlim {
    /** The record id. */
    readonly id: string
    /** The responsibility the draft follows up. */
    readonly responsibility_id: string
    /** The proposed message awaiting approval. */
    readonly draft: string
    /** When the record was created, as ISO text. */
    readonly created_at: string
}

/** A recorded outcome of a lead. */
export interface OutcomeSlim {
    /** The linked customer, when one is known. */
    readonly lead_id: string | null
    /** The recorded evidence line, when available. */
    readonly evidence: string | null
    /** When the record was created, as ISO text. */
    readonly created_at: string
}

/** The evidence line of something NIVO did by policy. */
export interface AutoEvidenceSlim {
    /** The flow item this evidence belongs to. */
    readonly work_item_id: string | null
    /** The recorded evidence line, when available. */
    readonly evidence: string | null
}

/** Everything the Sales workbench is derived from. */
export interface SalesRows {
    /** The instant used to derive overdue work and reporting windows. */
    readonly nowMs: number
    /** The bounded recent customers of the workspace. */
    readonly leads: ReadonlyArray<LeadRecord>
    /** The open responsibilities ordered by due date. */
    readonly steps: ReadonlyArray<ResponsibilityRecord>
    /** The bounded non-draft orders, newest first. */
    readonly orders: ReadonlyArray<Order>
    /** The workspace invoices used to resolve Accounting handoffs. */
    readonly invoices: ReadonlyArray<Invoice>
    /** Customer conversations linked to leads. */
    readonly conversations: ReadonlyArray<ConversationSlim>
    /** The newest messages of those conversations, newest first. */
    readonly messages: ReadonlyArray<MessageSlim>
    /** Legacy execution drafts waiting for approval. */
    readonly drafts: ReadonlyArray<DraftSlim>
    /** The active staff choices offered by the workbench. */
    readonly staff: ReadonlyArray<{ readonly id: string; readonly name: string }>
    /** The newest recorded lead outcomes. */
    readonly outcomes: ReadonlyArray<OutcomeSlim>
    /** The latest flow items enriched with customer and staff names. */
    readonly items: ReadonlyArray<WorkItemView>
    /** Recent human Sales decisions. */
    readonly decided: ReadonlyArray<DecisionRow>
    /** The evidence behind automatic Sales actions. */
    readonly autoEvidence: ReadonlyArray<AutoEvidenceSlim>
    /** The recurring Sales contracts. */
    readonly contracts: ReadonlyArray<ContractResult>
    /** True when a customer name marks a test run (UAT or debug leads), which no figure counts. */
    readonly isTestRun: (...names: ReadonlyArray<TestRunName>) => boolean
}

const MIN = 60_000
const OPEN_STAGES: ReadonlySet<string> = new Set(["new", "qualified", "proposal"])
const AWAITING_REPLY_AFTER_MS = 3 * MIN
const BOARD_CLOSED_LIMIT = 8
const CONVERSION_WINDOW_DAYS = 90
const AUTO_ACTIVITY_LIMIT = 40
const VN_OFFSET_MS = 7 * 3_600_000
const PRIORITY: Record<AttentionKind, number> = { decision: 0, failed: 1, clarify: 2, overdue: 3, awaiting_reply: 4 }
/** Conversations whose last message the workbench reads: the ids to ask for. */
export const conversationIdsOf = (conversations: ReadonlyArray<ConversationSlim>): ReadonlyArray<string> =>
    conversations.map((conversation) => conversation.id)

/** The sales work done by policy that the activity surface shows, newest first. */
export const autoDoneItemsOf = (items: ReadonlyArray<WorkItemView>): ReadonlyArray<WorkItemView> =>
    items
        .filter((item) => item.department === "sales" && item.status === "done" && item.decided_path === "auto")
        .slice(0, AUTO_ACTIVITY_LIMIT)

/**
 * Conversion by source: leads created in the window that are now won, grouped by channel. Test-run leads are excluded.
 */
const conversionOf = (rows: SalesRows): SalesConversion => {
    const since = new Date(rows.nowMs - CONVERSION_WINDOW_DAYS * 86_400_000).toISOString()
    const bySource = new Map<string, { source: string; leads: number; won: number }>()
    let total = 0
    let won = 0
    for (const lead of rows.leads) {
        if (lead.created_at < since || rows.isTestRun(lead.contact_name, lead.company)) continue
        const source = lead.channel || "other"
        const row = bySource.get(source) ?? { source, leads: 0, won: 0 }
        row.leads += 1
        total += 1
        if (lead.stage === "won") {
            row.won += 1
            won += 1
        }
        bySource.set(source, row)
    }
    const sources = [...bySource.values()].sort((a, b) => b.leads - a.leads || b.won - a.won)
    return { windowDays: CONVERSION_WINDOW_DAYS, leads: total, won, sources }
}

/** Start of the current month in Vietnam time, as an ISO instant. */
const monthStartIso = (now: number): string => {
    const vn = new Date(now + VN_OFFSET_MS)
    return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - VN_OFFSET_MS).toISOString()
}

const clip = (text: string, n = 140): string => {
    const flat = text.replace(/\s+/g, " ").trim()
    return flat.length > n ? `${flat.slice(0, n - 1).trimEnd()}…` : flat
}

const textOf = (value: unknown): string => {
    if (typeof value === "string") return value
    return typeof value === "number" ? String(value) : ""
}

interface Lookups {
    /** Customers indexed by lead id. */
    readonly leadById: ReadonlyMap<string, LeadRecord>
    /** The first open responsibility of each customer. */
    readonly openStepByLead: ReadonlyMap<string, ResponsibilityRecord>
    /** The bounded non-draft orders, newest first. */
    readonly orders: ReadonlyArray<Order>
    /** The latest non-cancelled order of each customer. */
    readonly orderByLead: ReadonlyMap<string, Order>
    /** The latest quoted amount of each customer. */
    readonly quoteByLead: ReadonlyMap<string, number>
    /** The latest proposal waiting on each customer. */
    readonly waitingByLead: ReadonlyMap<string, WorkItemView>
    /** The recorded closing reason and instant of each customer. */
    readonly closedByLead: ReadonlyMap<string, { reason: string | null; at: string }>
    /** The newest customer conversation of each customer (the rows arrive newest first). */
    readonly conversationByLead: ReadonlyMap<string, string>
}

const lookupsOf = (rows: SalesRows): Lookups => {
    const openStepByLead = new Map<string, ResponsibilityRecord>()
    for (const step of rows.steps) if (!openStepByLead.has(step.lead_id)) openStepByLead.set(step.lead_id, step)
    const orders = rows.orders.filter((order) => order.status !== "cancelled")
    const orderByLead = new Map<string, Order>()
    for (const order of orders)
        if (order.lead_id && !orderByLead.has(order.lead_id)) orderByLead.set(order.lead_id, order)
    const quoteByLead = quotesByLeadOf(rows.items)
    const waitingByLead = new Map<string, WorkItemView>()
    for (const item of rows.items) {
        if (item.lead_id && item.status === "waiting_decision" && !waitingByLead.has(item.lead_id))
            waitingByLead.set(item.lead_id, item)
    }
    const closedByLead = new Map<string, { reason: string | null; at: string }>()
    for (const event of rows.outcomes) {
        if (event.lead_id && !closedByLead.has(event.lead_id))
            closedByLead.set(event.lead_id, { reason: event.evidence, at: event.created_at })
    }
    return {
        leadById: new Map(rows.leads.map((lead) => [lead.id, lead])),
        openStepByLead,
        orders,
        orderByLead,
        quoteByLead,
        waitingByLead,
        closedByLead,
        conversationByLead: conversationByLeadOf(rows.conversations),
    }
}


const valueSourceOf = (order: Order | undefined, quote: number | null | undefined): SalesDeal["valueSource"] => {
    if (order?.amount_vnd != null) return "order"
    return quote == null ? null : "quote"
}

const dealOf = (lead: LeadRecord, look: Lookups): SalesDeal => {
    const order = look.orderByLead.get(lead.id)
    const quote = look.quoteByLead.get(lead.id)
    const step = look.openStepByLead.get(lead.id)
    const waiting = look.waitingByLead.get(lead.id)
    const closed = lead.stage === "won" || lead.stage === "lost" ? look.closedByLead.get(lead.id) : undefined
    return {
        leadId: lead.id,
        customer: lead.contact_name,
        company: lead.company,
        channel: lead.channel,
        need: lead.need,
        stage: lead.stage,
        valueVnd: order?.amount_vnd ?? quote ?? null,
        valueSource: valueSourceOf(order, quote),
        nextStep: step?.next_action || waiting?.proposal.summary || null,
        dueAt: step?.due_at ?? null,
        owner: waiting?.assignedStaffName ?? step?.owner_name ?? null,
        createdAt: lead.created_at,
        closedReason: closed?.reason ?? null,
        closedAt: closed?.at ?? null,
    }
}

const decisionsOf = (rows: SalesRows, look: Lookups): ReadonlyArray<SalesDecision> => {
    const fromItems = rows.items
        .filter((item) => item.department === "sales" && item.status === "waiting_decision")
        .map((item): SalesDecision => ({
            id: item.id,
            source: "work_item",
            workItemId: item.id,
            executionId: null,
            leadId: item.lead_id,
            customer: item.lead?.contact_name ?? (textOf(item.proposal.fields?.customer) || "—"),
            action: item.action,
            reason: item.reason,
            summary: item.proposal.summary,
            draft: item.proposal.draft ?? "",
            amountVnd: typeof item.proposal.amount_vnd === "number" ? item.proposal.amount_vnd : null,
            hasAmount: item.proposal.amount_vnd !== undefined || item.missing_fields.includes("amount_vnd"),
            missing: item.missing_fields,
            assignedStaffId: item.assigned_staff_id,
            assignedStaffName: item.assignedStaffName,
            createdAt: item.created_at,
            conversationId: conversationOf(look.conversationByLead, item.lead_id),
        }))
    const stepById = new Map(rows.steps.map((step) => [step.id, step]))
    const fromDrafts = rows.drafts.map((draft): SalesDecision => {
        const step = stepById.get(draft.responsibility_id)
        const lead = step ? look.leadById.get(step.lead_id) : undefined
        return {
            id: draft.id,
            source: "execution",
            workItemId: null,
            executionId: draft.id,
            leadId: lead?.id ?? null,
            customer: lead?.contact_name ?? "—",
            action: "follow_up",
            reason: null,
            summary: step?.next_action ?? "",
            draft: draft.draft,
            amountVnd: null,
            hasAmount: false,
            missing: [],
            assignedStaffId: null,
            assignedStaffName: null,
            createdAt: draft.created_at,
            conversationId: conversationOf(look.conversationByLead, lead?.id ?? null),
        }
    })
    return [...fromItems, ...fromDrafts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Finds open customer conversations still awaiting a reply. */
const awaitingReplies = (rows: SalesRows, look: Lookups): Array<AttentionRow> => {
    const rowsOut: Array<AttentionRow> = []
    const latest = new Map<string, MessageSlim>()
    for (const message of rows.messages)
        if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message)
    const seen = new Set<string>()
    for (const conversation of rows.conversations) {
        const message = latest.get(conversation.id)
        const lead = conversation.lead_id ? look.leadById.get(conversation.lead_id) : undefined
        if (message?.role !== "user" || !lead || !OPEN_STAGES.has(lead.stage) || seen.has(lead.id)) continue
        if (rows.nowMs - Date.parse(message.created_at) < AWAITING_REPLY_AFTER_MS) continue
        seen.add(lead.id)
        rowsOut.push({
            key: `reply:${conversation.id}`,
            kind: "awaiting_reply",
            leadId: lead.id,
            customer: lead.contact_name,
            company: lead.company,
            stage: lead.stage,
            need: clip(message.body),
            since: message.created_at,
            owner: conversation.handled_by ?? look.openStepByLead.get(lead.id)?.owner_name ?? null,
            workItemId: null,
            decisionId: null,
            action: null,
            missing: [],
            conversationId: conversation.id,
        })
    }
    return rowsOut
}

const attentionOf = (
    rows: SalesRows,
    look: Lookups,
    decisions: ReadonlyArray<SalesDecision>,
): ReadonlyArray<AttentionRow> => {
    const stageOf = (leadId: string | null): string | null =>
        leadId ? (look.leadById.get(leadId)?.stage ?? null) : null
    const companyOf = (leadId: string | null): string => (leadId ? (look.leadById.get(leadId)?.company ?? "") : "")
    const rowsOut: Array<AttentionRow> = []
    for (const decision of decisions) {
        rowsOut.push({
            key: `decision:${decision.id}`,
            kind: decision.missing.length > 0 ? "clarify" : "decision",
            leadId: decision.leadId,
            customer: decision.customer,
            company: companyOf(decision.leadId),
            stage: stageOf(decision.leadId),
            need: clip(decision.summary),
            since: decision.createdAt,
            owner:
                decision.assignedStaffName ??
                (decision.leadId ? (look.openStepByLead.get(decision.leadId)?.owner_name ?? null) : null),
            workItemId: decision.workItemId,
            decisionId: decision.id,
            action: decision.action === "follow_up" ? "send_follow_up" : decision.action,
            missing: decision.missing,
            conversationId: decision.conversationId,
        })
    }
    for (const item of rows.items) {
        if (item.department !== "sales" || item.status !== "failed") continue
        rowsOut.push({
            key: `failed:${item.id}`,
            kind: "failed",
            leadId: item.lead_id,
            customer: item.lead?.contact_name ?? "—",
            company: item.lead?.company ?? "",
            stage: stageOf(item.lead_id),
            need: clip(item.error || item.proposal.summary),
            since: item.updated_at,
            owner:
                item.assignedStaffName ??
                (item.lead_id ? (look.openStepByLead.get(item.lead_id)?.owner_name ?? null) : null),
            workItemId: item.id,
            decisionId: null,
            action: item.action,
            missing: [],
            conversationId: conversationOf(look.conversationByLead, item.lead_id),
        })
    }
    for (const step of rows.steps) {
        const lead = look.leadById.get(step.lead_id)
        if (
            !lead ||
            !OPEN_STAGES.has(lead.stage) ||
            !step.due_at ||
            Date.parse(step.due_at) >= rows.nowMs ||
            step.status === "waiting_approval"
        )
            continue
        rowsOut.push({
            key: `overdue:${step.id}`,
            kind: "overdue",
            leadId: lead.id,
            customer: lead.contact_name,
            company: lead.company,
            stage: lead.stage,
            need: clip(step.next_action || step.title),
            since: step.due_at,
            owner: step.owner_name,
            workItemId: null,
            decisionId: null,
            action: null,
            missing: [],
            conversationId: conversationOf(look.conversationByLead, lead.id),
        })
    }
    rowsOut.push(...awaitingReplies(rows, look))
    return rowsOut.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.since.localeCompare(b.since))
}

const activityOf = (rows: SalesRows): ReadonlyArray<AutoActivity> => {
    const evidenceByItem = new Map<string, string>()
    for (const event of rows.autoEvidence)
        if (event.work_item_id && !evidenceByItem.has(event.work_item_id))
            evidenceByItem.set(event.work_item_id, event.evidence ?? "")
    return autoDoneItemsOf(rows.items).map((item) => ({
        id: item.id,
        action: item.action,
        leadId: item.lead_id,
        customer: item.lead?.contact_name ?? null,
        summary: item.result?.summary ?? item.proposal.summary,
        at: item.completed_at ?? item.updated_at,
        evidenceState: item.evidence_state,
        evidence: evidenceByItem.get(item.id) || null,
        href: item.result?.href ?? item.href,
    }))
}

const metricsOf = (
    rows: SalesRows,
    look: Lookups,
    openDeals: ReadonlyArray<SalesDeal>,
    waitingCount: number,
): SalesMetrics => {
    const monthStart = monthStartIso(rows.nowMs)
    const wonIds = new Set<string>()
    let wonValueVnd = 0
    for (const order of look.orders) {
        if (
            order.confirmed_at &&
            order.confirmed_at >= monthStart &&
            order.lead_id &&
            look.leadById.get(order.lead_id)?.stage === "won"
        ) {
            wonIds.add(order.lead_id)
            wonValueVnd += order.amount_vnd ?? 0
        }
    }
    for (const event of rows.outcomes) {
        if (event.created_at >= monthStart && event.lead_id && look.leadById.get(event.lead_id)?.stage === "won")
            wonIds.add(event.lead_id)
    }
    const proposals = openDeals.filter((deal) => deal.stage === "proposal")
    return {
        openCount: openDeals.length,
        proposalValueVnd: proposals.reduce((sum, deal) => sum + (deal.valueVnd ?? 0), 0),
        proposalCount: proposals.length,
        wonCount: wonIds.size,
        wonValueVnd,
        waitingCount,
        conversion: conversionOf(rows),
    }
}

/** Derives the whole Sales workbench from the rows the flow already writes; nothing is invented. */
export const buildSalesWorkbench = (rows: SalesRows): SalesWorkbenchData => {
    const look = lookupsOf(rows)
    const allDeals = rows.leads.map((lead) => dealOf(lead, look))
    const openDeals = allDeals.filter((deal) => OPEN_STAGES.has(deal.stage))
    const closed = (stage: "won" | "lost"): ReadonlyArray<SalesDeal> =>
        allDeals
            .filter((deal) => deal.stage === stage)
            .sort((a, b) => (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt))
    const won = closed("won")
    const lost = closed("lost")
    const decisions = decisionsOf(rows, look)
    return {
        nowIso: new Date(rows.nowMs).toISOString(),
        metrics: metricsOf(rows, look, openDeals, decisions.length),
        attention: attentionOf(rows, look, decisions),
        deals: [...openDeals, ...won.slice(0, BOARD_CLOSED_LIMIT), ...lost.slice(0, BOARD_CLOSED_LIMIT)],
        closedHidden: {
            won: Math.max(0, won.length - BOARD_CLOSED_LIMIT),
            lost: Math.max(0, lost.length - BOARD_CLOSED_LIMIT),
        },
        decisions,
        decided: rows.decided,
        handoffs: handoffsOf(rows, look),
        activity: activityOf(rows),
        staff: rows.staff,
        contracts: [...rows.contracts].sort(
            (a, b) => Number(a.status !== "active") - Number(b.status !== "active") || a.endsOn.localeCompare(b.endsOn),
        ),
        leadOptions: rows.leads.slice(0, 200).map((lead) => ({
            id: lead.id,
            name: lead.company && lead.company !== "—" ? `${lead.contact_name} · ${lead.company}` : lead.contact_name,
        })),
    }
}
