import { LEAD_FACTS, MEMORY_RETENTION } from "@nivo-lite/agent-sdk/node"
import type {
    LeadFact,
    LeadMemorySnapshot,
    MemorySubject,
    MemoryWrite,
    StepFailure,
    StepMemory,
    StepOutcomeStatus,
} from "@nivo-lite/agent-sdk/node"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { OptionalMemorySubject, OptionalText, TriggerScope } from "./lead-memory.contracts"

/** The namespace of the facts of a customer: one entry per customer, whatever workflow proved them. */
export const LEAD_NAMESPACE = "$lead"

/** The node key of the facts entry. */
export const FACTS_NODE = "$facts"

/** The node key of a workflow's trigger entry: the trigger of its latest run. */
export const TRIGGER_NODE = "$trigger"

/** The prefix of the key of a customer who is a lead. */
export const LEAD_KEY = "lead:"

/** The prefix of the key of a customer who is not a lead yet: their conversation. */
export const CONVERSATION_KEY = "conversation:"

const DAY_MS = 24 * 60 * 60_000

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isJson = (value: unknown): value is JsonValue =>
    value === null || ["string", "number", "boolean"].includes(typeof value) || Array.isArray(value) || isObject(value)

/** Whether a value is a JSON object. */
export const isJsonRecord = (value: unknown): value is Readonly<Record<string, JsonValue>> => isObject(value)

/** A stored value as JSON; null when it is not. */
export const jsonOf = (value: unknown): JsonValue => (isJson(value) ? value : null)

/** The lead facts, for a quick check of a member name. */
const LEAD_FACT_SET: ReadonlySet<string> = new Set(LEAD_FACTS)

/** Who a trigger scope is about: the lead it names, else its conversation; null for a run about no customer. */
export const memorySubjectOf = (trigger: TriggerScope): OptionalMemorySubject => {
    const leadId = textOf(trigger.leadId)
    const conversationId = textOf(trigger.conversationId)
    if (leadId !== null) return { key: `${LEAD_KEY}${leadId}`, leadId, conversationId }
    if (conversationId !== null) return { key: `${CONVERSATION_KEY}${conversationId}`, leadId: null, conversationId }
    return null
}

/** The subject of a lead, with the conversation it came from when known. */
export const leadMemorySubjectOf = (leadId: string, conversationId: OptionalText): MemorySubject => ({
    key: `${LEAD_KEY}${leadId}`,
    leadId,
    conversationId,
})

/** The unique key of one entry: the customer, the workflow namespace, the node. */
export const entryKeyOf = (subjectKey: string, namespace: string, nodeKey: string): string =>
    `${subjectKey}|${namespace}|${nodeKey}`

/**
 * When an entry goes, by the retention policy (`MEMORY_RETENTION`): 30 days after the lead closed; 365 days after the last write while
 * it is open; 30 days after the last write for a conversation that never became a lead.
 */
export const expiresAtOf = (subject: MemorySubject, now: Date, closedAt: Date | null): Date => {
    if (closedAt !== null) return new Date(closedAt.getTime() + MEMORY_RETENTION.afterCloseDays * DAY_MS)
    const days = subject.leadId === null ? MEMORY_RETENTION.conversationIdleDays : MEMORY_RETENTION.openIdleDays
    return new Date(now.getTime() + days * DAY_MS)
}

/** The kind of an entry for a step that ended so. */
const kindOf = (status: StepOutcomeStatus): string => status

/** The values of the entry of one step's outcome. */
export const stepValuesOf = (write: MemoryWrite, now: Date): MutationValues => ({
    entryKey: entryKeyOf(write.subject.key, write.namespace, write.nodeKey),
    subjectKey: write.subject.key,
    leadId: write.subject.leadId,
    conversationId: write.subject.conversationId,
    namespace: write.namespace,
    nodeKey: write.nodeKey,
    step: write.step,
    kind: kindOf(write.outcome.status),
    agentId: write.agentId,
    workflowId: write.workflowId,
    runId: write.outcome.runId,
    versionId: write.outcome.versionId,
    output: { value: write.outcome.output },
    error: write.outcome.error === null ? null : { ...write.outcome.error },
    writtenAt: write.outcome.at,
    expiresAt: expiresAtOf(write.subject, now, null).toISOString(),
})

/** The values of the trigger entry of a workflow: the trigger of its latest run. */
export const triggerValuesOf = (write: MemoryWrite, now: Date): MutationValues => ({
    ...stepValuesOf(write, now),
    entryKey: entryKeyOf(write.subject.key, write.namespace, TRIGGER_NODE),
    nodeKey: TRIGGER_NODE,
    step: null,
    kind: "trigger",
    output: { value: write.trigger },
    error: null,
})

/** The values of the facts entry of a customer, with `facts` laid over what it held. */
export const factsValuesOf = (
    subject: MemorySubject,
    held: Readonly<Record<string, JsonValue>>,
    facts: Readonly<Partial<Record<LeadFact, JsonValue>>>,
    now: Date,
): MutationValues => ({
    entryKey: entryKeyOf(subject.key, LEAD_NAMESPACE, FACTS_NODE),
    subjectKey: subject.key,
    leadId: subject.leadId,
    conversationId: subject.conversationId,
    namespace: LEAD_NAMESPACE,
    nodeKey: FACTS_NODE,
    step: null,
    kind: "facts",
    agentId: null,
    workflowId: null,
    runId: null,
    versionId: null,
    output: { value: { ...held, ...factsOnly(facts) } },
    error: null,
    writtenAt: now.toISOString(),
    expiresAt: expiresAtOf(subject, now, null).toISOString(),
})

/** Only the members that are facts of `LEAD_FACTS` and hold something. */
const factsOnly = (facts: Readonly<Record<string, unknown>>): Readonly<Record<string, JsonValue>> =>
    Object.fromEntries(
        Object.entries(facts).filter(
            (entry): entry is [string, JsonValue] =>
                LEAD_FACT_SET.has(entry[0]) && entry[1] !== undefined && entry[1] !== null && entry[1] !== "" && isJson(entry[1]),
        ),
    )

/** What an entry holds: `output.value`. */
export const valueOfRow = (row: RecordRow): JsonValue => {
    const output = row.data.output
    const value: unknown = isObject(output) ? output["value"] : null
    return isJson(value) ? value : null
}

const STATUSES: ReadonlySet<string> = new Set(["done", "failed", "passed_over"])

const isStatus = (value: string): value is StepOutcomeStatus => STATUSES.has(value)

const failureOf = (value: unknown): StepFailure | null => {
    if (!isObject(value)) return null
    const code = textOf(value["code"])
    if (code === null) return null
    const fields = value["fields"]
    return {
        code,
        messageKey: textOf(value["messageKey"]) ?? "",
        message: textOf(value["message"]) ?? "",
        fields: isJsonRecord(fields) ? fields : {},
    }
}

/** The step outcome an entry holds, or null for a trigger or facts entry. */
export const stepMemoryOfRow = (row: RecordRow): StepMemory | null => {
    const kind = textOf(row.data.kind) ?? ""
    if (!isStatus(kind)) return null
    return {
        status: kind,
        output: valueOfRow(row),
        error: failureOf(row.data.error),
        runId: textOf(row.data.runId) ?? "",
        versionId: textOf(row.data.versionId) ?? "",
        at: textOf(row.data.writtenAt) ?? row.updatedAt,
    }
}

/**
 * The facts of a customer the lead record itself holds: the name, the phone, the email and the channel. The delivery details (address,
 * recipient, time) are NOT read from the record's `consultFacts`: an order is the one home of how a delivery goes, and the facts a
 * consult proves live in this memory; a copy kept on the record went stale and was handed to the next consult as if it were true.
 */
export const factsOfLead = (lead: RecordRow | null): Readonly<Partial<Record<LeadFact, JsonValue>>> => {
    if (lead === null) return {}
    return factsOnly({
        name: lead.data.contactName,
        phone: lead.data.phone,
        email: lead.data.email,
        channel: lead.data.channel,
    })
}

/**
 * The snapshot of a customer from their entries and their lead record: the facts (the lead record's, overlaid with the facts the nodes
 * proved: what a node saw last is newer than the record) and the latest outcome of each node of each workflow. Entries under the lead
 * win over the ones still under the conversation.
 */
export const snapshotOf = (
    subject: MemorySubject,
    rows: ReadonlyArray<RecordRow>,
    lead: RecordRow | null,
): LeadMemorySnapshot => {
    const ordered = [...rows].sort(
        (left, right) =>
            Number(String(left.data.subjectKey) === subject.key) - Number(String(right.data.subjectKey) === subject.key),
    )
    const proved: Record<string, JsonValue> = {}
    const workflows: Record<string, Record<string, StepMemory>> = {}
    for (const row of ordered) {
        const namespace = textOf(row.data.namespace) ?? ""
        const nodeKey = textOf(row.data.nodeKey) ?? ""
        if (row.data.kind === "facts") {
            const value = valueOfRow(row)
            if (isObject(value)) Object.assign(proved, value)
            continue
        }
        const memory = stepMemoryOfRow(row)
        if (memory === null) continue
        workflows[namespace] = { ...workflows[namespace], [nodeKey]: memory }
    }
    return { subject, lead: { ...factsOfLead(lead), ...factsOnly(proved) }, workflows }
}
