import {
    LEAD_FACTS,
    MEMORY_RETENTION,
    type LeadFact,
    type LeadMemorySnapshot,
    type MemorySubject,
    type MemoryWrite,
    type StepFailure,
    type StepMemory,
    type StepOutcomeStatus,
} from "@nivo-lite/agent-sdk/node"
import { CONTACT_KEY, type ContactMemoryEntry, type ContactMemoryValues, type ContactWithIdentities } from "@modules/domain/contacts"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { OptionalMemorySubject, OptionalText, TriggerScope } from "./lead-memory.contracts"

/** The namespace of the facts of a customer: one entry per customer, whatever workflow proved them. */
export const LEAD_NAMESPACE = "$lead"

/** The node key of the facts entry. */
export const FACTS_NODE = "$facts"

/** The node key of a workflow's trigger entry: the trigger of its latest run. */
export const TRIGGER_NODE = "$trigger"

/** The prefix of the key of a person no contact holds yet: their conversation. */
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

/** Who a trigger scope is about: the contact it names, else its conversation; null for a run about nobody. */
export const memorySubjectOf = (trigger: TriggerScope): OptionalMemorySubject => {
    const contactId = textOf(trigger.contactId)
    const conversationId = textOf(trigger.conversationId)
    if (contactId !== null) return { key: `${CONTACT_KEY}${contactId}`, contactId, conversationId }
    if (conversationId !== null) return { key: `${CONVERSATION_KEY}${conversationId}`, contactId: null, conversationId }
    return null
}

/** The subject of a contact, with the conversation it came from when known. */
export const contactMemorySubjectOf = (contactId: string, conversationId: OptionalText): MemorySubject => ({
    key: `${CONTACT_KEY}${contactId}`,
    contactId,
    conversationId,
})

/**
 * The memory subject of a lead id, keyed `lead:<id>`, for the sales module's bridge.
 * @deprecated A BRIDGE for the sales module only (`sales-effects`, the care opt-out door), which still names its own lead: the subject of
 * a lead id under `lead:<id>`, read by no engine read (the engine keys memory by the contact). Removed when that module remembers
 * through the contact (`nivo.tool.contact.memory.remember`, or its lead's `contact_id`).
 */
export const leadMemorySubjectOf = (leadId: string, conversationId: OptionalText): MemorySubject => ({
    key: `lead:${leadId}`,
    contactId: null,
    conversationId,
})

/** The unique key of one entry: the customer, the workflow namespace, the node. */
export const entryKeyOf = (subjectKey: string, namespace: string, nodeKey: string): string =>
    `${subjectKey}|${namespace}|${nodeKey}`

/**
 * When an entry goes, by the retention policy (`MEMORY_RETENTION`): 30 days after the memory closed; 365 days after the last write
 * while it is open; 30 days after the last write for a conversation no contact holds.
 */
export const expiresAtOf = (subject: MemorySubject, now: Date, closedAt: Date | null): Date => {
    if (closedAt !== null) return new Date(closedAt.getTime() + MEMORY_RETENTION.afterCloseDays * DAY_MS)
    const days = subject.contactId === null ? MEMORY_RETENTION.conversationIdleDays : MEMORY_RETENTION.openIdleDays
    return new Date(now.getTime() + days * DAY_MS)
}

/** The kind of an entry for a step that ended so. */
const kindOf = (status: StepOutcomeStatus): string => status

/** The values of the entry of one step's outcome. */
export const stepValuesOf = (write: MemoryWrite, now: Date): ContactMemoryValues => ({
    entryKey: entryKeyOf(write.subject.key, write.namespace, write.nodeKey),
    subjectKey: write.subject.key,
    contactId: write.subject.contactId,
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
    closedAt: null,
    expiresAt: expiresAtOf(write.subject, now, null).toISOString(),
})

/** The values of the trigger entry of a workflow: the trigger of its latest run. */
export const triggerValuesOf = (write: MemoryWrite, now: Date): ContactMemoryValues => ({
    ...stepValuesOf(write, now),
    entryKey: entryKeyOf(write.subject.key, write.namespace, TRIGGER_NODE),
    nodeKey: TRIGGER_NODE,
    step: null,
    kind: "trigger",
    output: { value: write.trigger },
    error: null,
})

/** The most dates a customer's memory keeps (`occasions`): the newest are kept. */
export const OCCASIONS_MAX = 20

/**
 * `facts` laid over what the entry held. A list fact (`occasions`, the dates the customer cares about) ADDS to the list held, each entry
 * once, newest last: a step that hears one new date keeps the ones heard before (D-MX-6); any other fact is replaced by the newer value.
 */
/** The entries of a list fact, or null for a value that is no list. */
const listOf = (value: JsonValue | undefined): ReadonlyArray<JsonValue> | null =>
    Array.isArray(value) ? value.filter((entry: unknown): entry is JsonValue => isJson(entry)) : null

const laidOver = (
    held: Readonly<Record<string, JsonValue>>,
    facts: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> =>
    Object.fromEntries(
        Object.entries({ ...held, ...facts }).map(([name, value]): [string, JsonValue] => {
            const before = listOf(held[name])
            const after = listOf(value)
            if (before === null || after === null || held[name] === value) return [name, value]
            const entries = [...before, ...after]
            const byText = new Map(entries.map((entry): [string, JsonValue] => [JSON.stringify(entry), entry]))
            return [name, [...byText.values()].slice(-OCCASIONS_MAX)]
        }),
    )

/** The values of the facts entry of a customer, with `facts` laid over what it held (a list fact adds to the list). */
export const factsValuesOf = (
    subject: MemorySubject,
    held: Readonly<Record<string, JsonValue>>,
    facts: Readonly<Partial<Record<LeadFact, JsonValue>>>,
    now: Date,
): ContactMemoryValues => ({
    entryKey: entryKeyOf(subject.key, LEAD_NAMESPACE, FACTS_NODE),
    subjectKey: subject.key,
    contactId: subject.contactId,
    conversationId: subject.conversationId,
    namespace: LEAD_NAMESPACE,
    nodeKey: FACTS_NODE,
    step: null,
    kind: "facts",
    agentId: null,
    workflowId: null,
    runId: null,
    versionId: null,
    output: { value: laidOver(held, factsOnly(facts)) },
    error: null,
    writtenAt: now.toISOString(),
    closedAt: null,
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
export const valueOfRow = (row: ContactMemoryEntry): JsonValue => {
    const value: unknown = row.output["value"]
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
export const stepMemoryOfRow = (row: ContactMemoryEntry): StepMemory | null => {
    const kind = row.kind
    if (!isStatus(kind)) return null
    return {
        status: kind,
        output: valueOfRow(row),
        error: failureOf(row.error),
        runId: row.runId ?? "",
        versionId: row.versionId ?? "",
        at: textOf(row.writtenAt) ?? row.updatedAt,
    }
}

/**
 * The facts of a person the contact itself holds: the name and the first verified phone, mail and channel. The delivery details
 * (address, recipient, time) and what care needs (`careOptOut`, `occasions`) live in this memory only: an order is the one home of how a
 * delivery goes.
 */
export const factsOfContact = (contact: ContactWithIdentities | null): Readonly<Partial<Record<LeadFact, JsonValue>>> => {
    if (contact === null) return {}
    const first = (kind: string): string | null =>
        contact.identities.find((one) => one.kind === kind && one.verified)?.[kind === "channel" ? "provider" : "value"] ?? null
    return factsOnly({ name: contact.displayName, phone: first("phone"), email: first("email"), channel: first("channel") })
}

/**
 * The snapshot of a person from their entries and their contact: the facts (the contact's, overlaid with the facts the nodes proved:
 * what a node saw last is newer) and the latest outcome of each node of each workflow. Entries under the contact win over the ones
 * still under the conversation.
 */
export const snapshotOf = (
    subject: MemorySubject,
    rows: ReadonlyArray<ContactMemoryEntry>,
    contact: ContactWithIdentities | null,
): LeadMemorySnapshot => {
    const ordered = [...rows].sort(
        (left, right) => Number(left.subjectKey === subject.key) - Number(right.subjectKey === subject.key),
    )
    const proved: Record<string, JsonValue> = {}
    const workflows: Record<string, Record<string, StepMemory>> = {}
    for (const row of ordered) {
        const { namespace, nodeKey } = row
        if (row.kind === "facts") {
            const value = valueOfRow(row)
            if (isObject(value)) Object.assign(proved, value)
            continue
        }
        const memory = stepMemoryOfRow(row)
        if (memory === null) continue
        workflows[namespace] = { ...workflows[namespace], [nodeKey]: memory }
    }
    return { subject, lead: { ...factsOfContact(contact), ...factsOnly(proved) }, workflows }
}
