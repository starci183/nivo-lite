import "server-only"

import type { GovernanceRows } from "@/lib/flow-queries"
import type { Agent, Lead, Message, ResponsibilityWithLead } from "@/lib/types"
import {
    isRecord,
    recordsOf,
    textOf,
    toAgents,
    toLead,
    toMessage,
    toResponsibilityWithLead,
} from "../overview/overview.mapper"
import type { DbRecord } from "../overview/overview.mapper"

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

const responsibilitiesOf = (value: unknown): Array<ResponsibilityWithLead> =>
    recordsOf(value).flatMap((record) => {
        const row = toResponsibilityWithLead(record)
        return row === null ? [] : [row]
    })

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
