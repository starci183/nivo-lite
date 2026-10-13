import "server-only"

import { isModuleKey } from "@/lib/modules-shared"
import type {
    Agent,
    EventRow,
    Execution,
    ExecutionStatus,
    Lead,
    LeadStage,
    Message,
    Responsibility,
    ResponsibilityStatus,
    ResponsibilityWithLead,
} from "@/lib/types"

/** Any record the database or an RPC handed over: a table row or one element of a JSON payload. */
export type DbRecord = Readonly<Record<string, unknown>>

/** Whether a value is a plain record. */
export const isRecord = (value: unknown): value is DbRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The records of a JSON array; anything else is not a list of records. */
export const recordsOf = (value: unknown): ReadonlyArray<DbRecord> =>
    Array.isArray(value) ? value.filter(isRecord) : []

/** A text field, empty when it is missing. */
export const textOf = (record: DbRecord, key: string): string => {
    const value = record[key]
    return typeof value === "string" ? value : ""
}

/** A text field that may be null. */
export const textOrNull = (record: DbRecord, key: string): string | null => {
    const value = record[key]
    return typeof value === "string" ? value : null
}

const STAGES: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal", "won", "lost"]
const RESPONSIBILITY_STATUSES: ReadonlyArray<ResponsibilityStatus> = ["open", "waiting_approval", "done"]
const EXECUTION_STATUSES: ReadonlyArray<ExecutionStatus> = ["pending_approval", "approved", "rejected"]

/** The pipeline stage a text names; an unknown text is a new lead. */
export const stageOf = (value: string): LeadStage => STAGES.find((stage) => stage === value) ?? "new"

const authorKindOf = (value: string): Message["author_kind"] => {
    if (value === "agent" || value === "system") return value
    return "human"
}

/** An agent row; null when its module is not one the registry knows. */
export const toAgent = (record: DbRecord): Agent | null => {
    const module = textOf(record, "module")
    if (!isModuleKey(module)) return null
    return {
        id: textOf(record, "id"),
        workspace_id: textOf(record, "workspace_id"),
        module,
        name: textOf(record, "name"),
        handle: textOf(record, "handle"),
        role: textOf(record, "role"),
        instructions: textOf(record, "instructions"),
        knowledge: textOf(record, "knowledge"),
        greeting: textOf(record, "greeting"),
        approval_rule: textOf(record, "approval_rule"),
        status: record.status === "paused" ? "paused" : "active",
        created_at: textOf(record, "created_at"),
    }
}

/** The agents of a list of records, leaving out those of an unknown module. */
export const toAgents = (records: ReadonlyArray<DbRecord>): Array<Agent> =>
    records.flatMap((record) => {
        const agent = toAgent(record)
        return agent === null ? [] : [agent]
    })

/** The origin a lead was labelled with, or null for legacy rows. */
const originOf = (value: unknown): "live" | "simulated" | null => {
    if (value === "simulated" || value === "live") return value
    return null
}

/** A lead row. */
export const toLead = (record: DbRecord): Lead => ({
    id: textOf(record, "id"),
    workspace_id: textOf(record, "workspace_id"),
    contact_name: textOf(record, "contact_name"),
    company: textOf(record, "company"),
    channel: textOf(record, "channel"),
    need: textOf(record, "need"),
    stage: stageOf(textOf(record, "stage")),
    context_summary: textOrNull(record, "context_summary"),
    created_at: textOf(record, "created_at"),
    phone: textOrNull(record, "phone"),
    email: textOrNull(record, "email"),
    origin: originOf(record.origin),
})

/** A responsibility row. */
export const toResponsibility = (record: DbRecord): Responsibility => ({
    id: textOf(record, "id"),
    workspace_id: textOf(record, "workspace_id"),
    lead_id: textOf(record, "lead_id"),
    title: textOf(record, "title"),
    owner_kind: record.owner_kind === "agent" ? "agent" : "human",
    owner_agent_id: textOrNull(record, "owner_agent_id"),
    owner_name: textOf(record, "owner_name"),
    next_action: textOf(record, "next_action"),
    due_at: textOrNull(record, "due_at"),
    status: RESPONSIBILITY_STATUSES.find((status) => status === record.status) ?? "open",
    created_at: textOf(record, "created_at"),
})

/** A responsibility with the lead it belongs to; null when the lead is missing. */
export const toResponsibilityWithLead = (record: DbRecord): ResponsibilityWithLead | null => {
    const lead = record.lead
    if (!isRecord(lead)) return null
    return {
        ...toResponsibility(record),
        lead: {
            id: textOf(lead, "id"),
            contact_name: textOf(lead, "contact_name"),
            company: textOf(lead, "company"),
            stage: stageOf(textOf(lead, "stage")),
        },
    }
}

/** An execution row. */
export const toExecution = (record: DbRecord): Execution => ({
    id: textOf(record, "id"),
    workspace_id: textOf(record, "workspace_id"),
    responsibility_id: textOf(record, "responsibility_id"),
    agent_id: textOrNull(record, "agent_id"),
    kind: textOf(record, "kind"),
    draft: textOf(record, "draft"),
    status: EXECUTION_STATUSES.find((status) => status === record.status) ?? "pending_approval",
    decided_by: textOrNull(record, "decided_by"),
    decided_at: textOrNull(record, "decided_at"),
    created_at: textOf(record, "created_at"),
    work_item_id: textOrNull(record, "work_item_id"),
    staff_id: textOrNull(record, "staff_id"),
})

/** An evidence event row. */
export const toEvent = (record: DbRecord): EventRow => ({
    id: textOf(record, "id"),
    workspace_id: textOf(record, "workspace_id"),
    lead_id: textOrNull(record, "lead_id"),
    kind: textOf(record, "kind"),
    actor: textOf(record, "actor"),
    summary: textOf(record, "summary"),
    evidence: textOrNull(record, "evidence"),
    created_at: textOf(record, "created_at"),
})

/** An Office message row. */
export const toMessage = (record: DbRecord): Message => ({
    id: textOf(record, "id"),
    workspace_id: textOf(record, "workspace_id"),
    author_kind: authorKindOf(textOf(record, "author_kind")),
    author_name: textOf(record, "author_name"),
    agent_id: textOrNull(record, "agent_id"),
    body: textOf(record, "body"),
    lead_id: textOrNull(record, "lead_id"),
    created_at: textOf(record, "created_at"),
    work_item_id: textOrNull(record, "work_item_id"),
})
