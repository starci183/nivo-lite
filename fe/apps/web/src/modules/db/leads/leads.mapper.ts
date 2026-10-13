import type { Database } from "../../../../../../../supabase/types/database.types"
import type {
    AgentRecord,
    EventRecord,
    ExecutionRecord,
    DraftStatus,
    LeadListItem,
    LeadRecord,
    LeadStageId,
    OwnerKind,
    ResponsibilityRecord,
    StepStatus,
} from "@/modules/types"

type Tables = Database["public"]["Tables"]

/** One generated row of public.leads. */
export type LeadsRow = Tables["leads"]["Row"]
/** One generated row of public.responsibilities. */
export type ResponsibilitiesRow = Tables["responsibilities"]["Row"]
/** One generated row of public.executions. */
export type ExecutionsRow = Tables["executions"]["Row"]
/** One generated row of public.events. */
export type EventsRow = Tables["events"]["Row"]
/** One generated row of public.agents. */
export type AgentsRow = Tables["agents"]["Row"]

/** The open step columns the list needs. */
export type OpenStepRow = Pick<ResponsibilitiesRow, "lead_id" | "owner_name" | "next_action">

const STAGES: ReadonlyArray<LeadStageId> = ["new", "qualified", "proposal", "won", "lost"]
const STATUSES: ReadonlyArray<StepStatus> = ["open", "waiting_approval", "done"]
const EXECUTION_STATUSES: ReadonlyArray<DraftStatus> = ["pending_approval", "approved", "rejected"]

/** The stage a stored text names; a value outside the closed set (never written by the app) reads as a new lead. */
export const stageOf = (value: string): LeadStageId => STAGES.find((stage) => stage === value) ?? "new"

const ownerKindOf = (value: string): OwnerKind => (value === "agent" ? "agent" : "human")

const statusOf = (value: string): StepStatus => STATUSES.find((status) => status === value) ?? "open"

const executionStatusOf = (value: string): DraftStatus =>
    EXECUTION_STATUSES.find((status) => status === value) ?? "pending_approval"

/** One lead row as the screens use it. */
export const toLeadRecord = (row: LeadsRow): LeadRecord => ({
    id: row.id,
    contact_name: row.contact_name,
    company: row.company,
    channel: row.channel,
    need: row.need,
    stage: stageOf(row.stage),
    context_summary: row.context_summary,
    origin: row.origin,
    created_at: row.created_at,
})

/** One responsibility row as the screens use it. */
export const toResponsibilityRecord = (row: ResponsibilitiesRow): ResponsibilityRecord => ({
    id: row.id,
    lead_id: row.lead_id,
    title: row.title,
    owner_kind: ownerKindOf(row.owner_kind),
    owner_agent_id: row.owner_agent_id,
    owner_name: row.owner_name,
    next_action: row.next_action,
    due_at: row.due_at,
    status: statusOf(row.status),
    created_at: row.created_at,
})

/** One execution row as the screens use it. */
export const toExecutionRecord = (row: ExecutionsRow): ExecutionRecord => ({
    id: row.id,
    workspace_id: row.workspace_id,
    responsibility_id: row.responsibility_id,
    agent_id: row.agent_id,
    kind: row.kind,
    draft: row.draft,
    status: executionStatusOf(row.status),
    decided_by: row.decided_by,
    decided_at: row.decided_at,
    work_item_id: row.work_item_id,
    created_at: row.created_at,
})

/** One evidence-log row as the screens use it. */
export const toEventRecord = (row: EventsRow): EventRecord => ({
    id: row.id,
    lead_id: row.lead_id,
    kind: row.kind,
    actor: row.actor,
    summary: row.summary,
    evidence: row.evidence,
    created_at: row.created_at,
})

/** One agent row as the owner choice uses it. */
export const toAgentRecord = (row: AgentsRow): AgentRecord => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    status: row.status,
    module: row.module,
})

/** Leads with the owner and next action of their open step (the oldest open step of the lead). */
export const toLeadListItems = (
    leads: ReadonlyArray<LeadsRow>,
    openSteps: ReadonlyArray<OpenStepRow>,
): ReadonlyArray<LeadListItem> =>
    leads.map((lead) => {
        const step = openSteps.find((candidate) => candidate.lead_id === lead.id)
        return { ...toLeadRecord(lead), owner_name: step?.owner_name ?? null, next_action: step?.next_action ?? null }
    })

/** What the new-lead form submits. */
export interface NewLeadInput {
    readonly contact_name: string
    readonly company: string
    readonly channel: string
    readonly need: string
}

type NewLeadParse = { readonly success: true; readonly data: NewLeadInput } | { readonly success: false }

const textWithin = (value: unknown, min: number, max: number): value is string =>
    typeof value === "string" && value.trim().length >= min && value.length <= max

/** Bounds what the new-lead form submits before it reaches the engine. */
export const newLeadSchema = {
    safeParse: (input: unknown): NewLeadParse => {
        if (typeof input !== "object" || input === null) return { success: false }
        const entries = Object.fromEntries(Object.entries(input))
        const { contact_name, company, channel, need } = entries
        if (!textWithin(contact_name, 2, 200) || !textWithin(company, 2, 200)) return { success: false }
        if (!textWithin(channel, 1, 100) || !textWithin(need, 5, 2000)) return { success: false }
        return {
            success: true,
            data: {
                contact_name: contact_name.trim(),
                company: company.trim(),
                channel: channel.trim(),
                need: need.trim(),
            },
        }
    },
}

type Parse<T> = { readonly success: true; readonly data: T } | { readonly success: false }

const isId = (value: unknown): value is string => typeof value === "string" && value.length >= 1 && value.length <= 64

const recordOf = (input: unknown): Readonly<Record<string, unknown>> | null =>
    typeof input === "object" && input !== null ? Object.fromEntries(Object.entries(input)) : null

/** Bounds one id (a lead or a step) before it reaches the engine. */
export const idSchema = {
    safeParse: (input: unknown): Parse<string> => (isId(input) ? { success: true, data: input } : { success: false }),
}

/** What settling a won deal takes. */
export interface SettleInput {
    readonly leadId: string
    readonly evidence: string
}

/** Bounds the lead and the evidence text of a won deal. */
export const settleSchema = {
    safeParse: (input: unknown): Parse<SettleInput> => {
        const fields = recordOf(input)
        const leadId = fields?.leadId
        const evidence = fields?.evidence
        if (!isId(leadId) || typeof evidence !== "string" || evidence.length > 2000) return { success: false }
        return { success: true, data: { leadId, evidence } }
    },
}
