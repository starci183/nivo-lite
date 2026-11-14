import { mock } from "@starci/jest-preset"
import type {
    LeadFact,
    LeadMemorySnapshot,
    MemorySubject,
    MemoryWrite,
    StepMemory,
} from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import type { NodeRow } from "@modules/domain/graph-nodes"

/** One node's outcome the memory keeps, with where it sits. */
interface Entry {
    readonly subjectKey: string
    readonly namespace: string
    readonly nodeKey: string
    readonly memory: StepMemory
}

/** The facts nodes proved, by customer key. */
type Facts = Map<string, Record<string, JsonValue>>

/** The in-memory lead memory of a world: the entries, the facts per customer, and the store it reads the lead record from. */
export interface LeadMemoryWorld {
    /** The service the step memory reads and writes, over the entries. */
    readonly service: LeadMemoryService
    /** The outcome entries, in write order. */
    readonly entries: Array<Entry>
    /** The facts nodes proved, by customer key. */
    readonly facts: Facts
}

/** The memory namespace of the Sales consult workflow. */
const CONSULT_NAMESPACE = "sales.consult"

const CONTACT_KEY = "contact:"
const CONVERSATION_KEY = "conversation:"

/** The keys a person's entries may sit under: their contact, then their conversation. */
const keysOf = (subject: MemorySubject): ReadonlyArray<string> => [
    subject.key,
    ...(subject.contactId === null ? [] : [`${CONTACT_KEY}${subject.contactId}`]),
    ...(subject.conversationId === null ? [] : [`${CONVERSATION_KEY}${subject.conversationId}`]),
]

/** The facts the contact itself holds, as the engine's memory reads them: the name; never a delivery detail. */
const factsOfLead = (lead: NodeRow | undefined): Readonly<Partial<Record<LeadFact, JsonValue>>> => {
    if (lead === undefined) return {}
    const wanted: ReadonlyArray<[LeadFact, unknown]> = [["name", lead.displayName]]
    return Object.fromEntries(wanted.filter(([, value]) => typeof value === "string" && value !== ""))
}

/** A lead whose consult is open in the store has the consult's outcome in memory: the front desk reads it as `stage`. */
const seededEntriesOf = (store: Record<string, Array<NodeRow>>): Array<Entry> =>
    (store["sales-lead"] ?? []).flatMap((lead) =>
        typeof lead.consultStage === "string" && typeof lead.id === "string"
            ? [
                  {
                      subjectKey: `${CONTACT_KEY}${lead.id}`,
                      namespace: CONSULT_NAMESPACE,
                      nodeKey: "consult",
                      memory: {
                          status: "done" as const,
                          output: { stage: lead.consultStage },
                          error: null,
                          runId: "run-before",
                          versionId: "version-before",
                          at: "2026-11-04T09:00:00.000Z",
                      },
                  },
              ]
            : [],
    )

/**
 * The facts a world seeded straight into the memory table (`store["agent-lead-memory"]`, rows of `entryKey` + `output.value`) under a
 * subject key: what a facts entry the engine wrote before the run holds.
 */
const seededFactsOf = (store: Record<string, Array<NodeRow>>, subjectKey: string): Record<string, JsonValue> =>
    (store["agent-lead-memory"] ?? [])
        .filter((row) => row.entryKey === `${subjectKey}|$lead|$facts`)
        .reduce<Record<string, JsonValue>>((all, row) => {
            const output = row.output
            const value: unknown = typeof output === "object" && output !== null ? Reflect.get(output, "value") : undefined
            return typeof value === "object" && value !== null && !Array.isArray(value) ? { ...all, ...(value as Record<string, JsonValue>) } : all
        }, {})

/** The snapshot of a customer: the facts (the lead record's under the ones nodes proved) and the latest outcome of each node. */
const snapshotOf = (
    store: Record<string, Array<NodeRow>>,
    entries: ReadonlyArray<Entry>,
    facts: Facts,
    subject: MemorySubject,
): LeadMemorySnapshot | null => {
    const keys = keysOf(subject)
    const lead = (store["contact"] ?? []).find((row) => row.id === subject.contactId)
    const own = entries.filter((entry) => keys.includes(entry.subjectKey))
    const proved = keys
        .toReversed()
        .reduce<Record<string, JsonValue>>((all, key) => ({ ...all, ...seededFactsOf(store, key), ...facts.get(key) }), {})
    if (own.length === 0 && lead === undefined && Object.keys(proved).length === 0) return null
    // Entries under the lead win over the ones still under the conversation: write the conversation's first.
    const ordered = own.toSorted(
        (left, right) => Number(left.subjectKey === subject.key) - Number(right.subjectKey === subject.key),
    )
    const workflows: Record<string, Record<string, StepMemory>> = {}
    for (const entry of ordered)
        workflows[entry.namespace] = { ...workflows[entry.namespace], [entry.nodeKey]: entry.memory }
    return { subject, lead: { ...factsOfLead(lead), ...proved }, workflows }
}

/** Writes one step's outcome over the entry the node had, and lays the facts it proved over the customer's. */
const writeTo = (entries: Array<Entry>, facts: Facts, one: MemoryWrite): void => {
    const entry: Entry = {
        subjectKey: one.subject.key,
        namespace: one.namespace,
        nodeKey: one.nodeKey,
        memory: one.outcome,
    }
    const at = entries.findIndex(
        (held) =>
            held.subjectKey === entry.subjectKey && held.namespace === entry.namespace && held.nodeKey === entry.nodeKey,
    )
    if (at < 0) entries.push(entry)
    else entries[at] = entry
    const proved = Object.fromEntries(Object.entries(one.facts).filter(([, value]) => value !== null && value !== ""))
    if (Object.keys(proved).length > 0) facts.set(one.subject.key, { ...facts.get(one.subject.key), ...proved })
}

/** Moves the entries and facts of a conversation to the lead it became; the lead's own entries win. */
const adoptInto = (entries: Array<Entry>, facts: Facts, conversationId: string, leadId: string): void => {
    const from = `${CONVERSATION_KEY}${conversationId}`
    const to = `${CONTACT_KEY}${leadId}`
    for (const entry of entries.filter((held) => held.subjectKey === from)) {
        entries.splice(entries.indexOf(entry), 1)
        const taken = entries.some(
            (other) => other.subjectKey === to && other.namespace === entry.namespace && other.nodeKey === entry.nodeKey,
        )
        if (!taken) entries.push({ ...entry, subjectKey: to })
    }
    const held = facts.get(from)
    if (held === undefined) return
    facts.set(to, { ...held, ...facts.get(to) })
    facts.delete(from)
}

/**
 * The lead memory of a world, in memory and shared by every run played in it: one memory per customer across every workflow, the
 * facts a node proved over the facts of the lead record (`sales-lead` of the store). It keeps what the engine's store keeps for the
 * steps: the snapshot a ref reads, the outcome a resume recalls, the write and the adoption of a conversation by its lead.
 */
export const leadMemoryWorldOf = (store: Record<string, Array<NodeRow>>): LeadMemoryWorld => {
    const entries = seededEntriesOf(store)
    const facts: Facts = new Map()
    const service = mock<LeadMemoryService>({
        snapshot: (_ws: string, subject: MemorySubject) => Promise.resolve(snapshotOf(store, entries, facts, subject)),
        stepOf: (_ws: string, subject: MemorySubject, runId: string, nodeKey: string) => {
            const keys = keysOf(subject)
            const found = entries.find(
                (entry) => keys.includes(entry.subjectKey) && entry.nodeKey === nodeKey && entry.memory.runId === runId,
            )
            return Promise.resolve(found?.memory ?? null)
        },
        write: (_ws: string, one: MemoryWrite) => {
            writeTo(entries, facts, one)
            return Promise.resolve()
        },
        adopt: (_ws: string, conversationId: string, leadId: string) => {
            adoptInto(entries, facts, conversationId, leadId)
            return Promise.resolve()
        },
    })
    return { service, entries, facts }
}

/** The outcome a node of a workflow last wrote for a customer, or undefined. */
export const outcomeIn = (world: LeadMemoryWorld, namespace: string, nodeKey: string): StepMemory | undefined =>
    world.entries.findLast((entry) => entry.namespace === namespace && entry.nodeKey === nodeKey)?.memory
