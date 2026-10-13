import "server-only"

import type { GovernanceRows } from "@/lib/flow-queries"
import type { Agent, EventRow, Lead, Message, ResponsibilityWithLead } from "@/lib/types"
import {
    isRecord,
    recordsOf,
    textOf,
    toAgents,
    toEvent,
    toLead,
    toMessage,
    toResponsibilityWithLead,
} from "../overview/overview.mapper"
import type { DbRecord } from "../overview/overview.mapper"

/** The pipeline stages a dashboard lead row carries. */
type DashboardLeadStage = "new" | "qualified" | "proposal" | "won" | "lost"

/** What the executive dashboard reads, in one payload (the `dashboard_data` function). */
export interface DashboardPayload {
    readonly responsibilities: Array<ResponsibilityWithLead>
    readonly agents: Array<Agent>
    readonly events: Array<EventRow>
    readonly leads: Array<{
        id: string
        stage: DashboardLeadStage
        created_at: string
        contact_name: string | null
        company: string | null
    }>
    readonly pending: Array<{ id: string; responsibility_id: string; created_at: string; lead_id: string | null }>
    readonly promo: DashboardPromo
    readonly governance: GovernanceRows
    readonly exceptions: Array<unknown>
}

/** The campaign facts of the dashboard payload. */
export interface DashboardPromo {
    readonly chatbot: { id: string; knowledge: string } | null
    readonly is_founding_member: boolean
    readonly website_leads: Array<{ id: string; created_at: string }>
    readonly first_events: Array<{ lead_id: string; at: string }>
    readonly has_customer_conversation: boolean
    readonly has_lead_conversation: boolean
    readonly approved_count: number
    readonly has_won: boolean
    readonly invoice_approved: boolean
}

/** What the Office page reads, in one payload (the `office_data` function). */
export interface OfficePayload {
    readonly messages: Array<Message>
    readonly agents: Array<Agent>
    readonly responsibilities: Array<ResponsibilityWithLead>
    readonly pending: Array<unknown>
    readonly decided: Array<unknown>
    readonly leads: Array<Lead>
    readonly open_responsibilities: Array<{
        lead_id: string
        owner_name: string | null
        next_action: string | null
        status: string
    }>
    readonly exceptions: Array<unknown>
    readonly recent_items: Array<unknown>
    readonly governance: GovernanceRows
    readonly staff: Array<unknown>
    readonly members: Array<{
        user_id: string
        role: "owner" | "manager" | "staff"
        staff_id: string | null
        display_name: string
        status: "active" | "disabled"
        email: string | null
        last_sign_in_at: string | null
    }>
}

const listOf = (value: unknown): Array<unknown> => (Array.isArray(value) ? [...value] : [])
const numberOf = (record: DbRecord, key: string): number => {
    const value = record[key]
    return typeof value === "number" ? value : 0
}
const numberOrNull = (record: DbRecord, key: string): number | null => {
    const value = record[key]
    return typeof value === "number" ? value : null
}
const textOrNullOf = (record: DbRecord, key: string): string | null => {
    const value = record[key]
    return typeof value === "string" ? value : null
}
const flagOf = (record: DbRecord, key: string): boolean => record[key] === true

const stageOf = (value: string): DashboardLeadStage => {
    if (value === "qualified" || value === "proposal" || value === "won" || value === "lost") return value
    return "new"
}

/** The governance rows of a payload; a missing section is an empty one. */
const toGovernanceRows = (value: unknown): GovernanceRows => {
    const record = isRecord(value) ? value : {}
    const auth = isRecord(record.auth) ? record.auth : null
    return {
        auth:
            auth === null
                ? null
                : {
                      goal_revenue_vnd: numberOrNull(auth, "goal_revenue_vnd"),
                      goal_new_customers: numberOrNull(auth, "goal_new_customers"),
                      goal_first_reply_minutes: numberOrNull(auth, "goal_first_reply_minutes"),
                  },
        leads: listOf(record.leads),
        orders: listOf(record.orders),
        invoices: listOf(record.invoices),
        txs: listOf(record.txs),
        work: listOf(record.work),
        pending_without_work: numberOf(record, "pending_without_work"),
        decisions7: listOf(record.decisions7),
        recent: listOf(record.recent),
    }
}

const toPromo = (value: unknown): DashboardPromo => {
    const record = isRecord(value) ? value : {}
    const chatbot = isRecord(record.chatbot) ? record.chatbot : null
    return {
        chatbot: chatbot === null ? null : { id: textOf(chatbot, "id"), knowledge: textOf(chatbot, "knowledge") },
        is_founding_member: flagOf(record, "is_founding_member"),
        website_leads: recordsOf(record.website_leads).map((lead) => ({
            id: textOf(lead, "id"),
            created_at: textOf(lead, "created_at"),
        })),
        first_events: recordsOf(record.first_events).map((event) => ({
            lead_id: textOf(event, "lead_id"),
            at: textOf(event, "at"),
        })),
        has_customer_conversation: flagOf(record, "has_customer_conversation"),
        has_lead_conversation: flagOf(record, "has_lead_conversation"),
        approved_count: numberOf(record, "approved_count"),
        has_won: flagOf(record, "has_won"),
        invoice_approved: flagOf(record, "invoice_approved"),
    }
}

const responsibilitiesOf = (value: unknown): Array<ResponsibilityWithLead> =>
    recordsOf(value).flatMap((record) => {
        const row = toResponsibilityWithLead(record)
        return row === null ? [] : [row]
    })

/** The dashboard payload as typed data. A payload that is not an object is not a dashboard. */
export const toDashboardPayload = (json: unknown): DashboardPayload | null => {
    if (!isRecord(json)) return null
    return {
        responsibilities: responsibilitiesOf(json.responsibilities),
        agents: toAgents(recordsOf(json.agents)),
        events: recordsOf(json.events).map(toEvent),
        leads: recordsOf(json.leads).map((lead) => ({
            id: textOf(lead, "id"),
            stage: stageOf(textOf(lead, "stage")),
            created_at: textOf(lead, "created_at"),
            contact_name: textOrNullOf(lead, "contact_name"),
            company: textOrNullOf(lead, "company"),
        })),
        pending: recordsOf(json.pending).map((row) => ({
            id: textOf(row, "id"),
            responsibility_id: textOf(row, "responsibility_id"),
            created_at: textOf(row, "created_at"),
            lead_id: textOrNullOf(row, "lead_id"),
        })),
        promo: toPromo(json.promo),
        governance: toGovernanceRows(json.governance),
        exceptions: listOf(json.exceptions),
    }
}

const roleOf = (value: string): "owner" | "manager" | "staff" => {
    if (value === "owner" || value === "manager") return value
    return "staff"
}

/** The Office payload as typed data. A payload that is not an object is not an Office. */
export const toOfficePayload = (json: unknown): OfficePayload | null => {
    if (!isRecord(json)) return null
    return {
        messages: recordsOf(json.messages).map(toMessage),
        agents: toAgents(recordsOf(json.agents)),
        responsibilities: responsibilitiesOf(json.responsibilities),
        pending: listOf(json.pending),
        decided: listOf(json.decided),
        leads: recordsOf(json.leads).map(toLead),
        open_responsibilities: recordsOf(json.open_responsibilities).map((row) => ({
            lead_id: textOf(row, "lead_id"),
            owner_name: textOrNullOf(row, "owner_name"),
            next_action: textOrNullOf(row, "next_action"),
            status: textOf(row, "status"),
        })),
        exceptions: listOf(json.exceptions),
        recent_items: listOf(json.recent_items),
        governance: toGovernanceRows(json.governance),
        staff: listOf(json.staff),
        members: recordsOf(json.members).map((row) => ({
            user_id: textOf(row, "user_id"),
            role: roleOf(textOf(row, "role")),
            staff_id: textOrNullOf(row, "staff_id"),
            display_name: textOf(row, "display_name"),
            status: textOf(row, "status") === "disabled" ? "disabled" : "active",
            email: textOrNullOf(row, "email"),
            last_sign_in_at: textOrNullOf(row, "last_sign_in_at"),
        })),
    }
}
