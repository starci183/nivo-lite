import type { LeadMemorySnapshot, MemorySubject, Sensitivity, StepMemory } from "@nivo-lite/agent-sdk/node"

/** The trigger scope of a run, as the memory reads who it is about. */
export interface TriggerScope {
    /** The contact the run is about, when it names one. */
    readonly contactId?: unknown
    /** The conversation the run is about, when it names one. */
    readonly conversationId?: unknown
    /** Every other member of the scope. */
    readonly [member: string]: unknown
}

/** An optional text: the conversation of a contact, when it is known. */
export type OptionalText = string | null

/** An optional subject: the customer a run is about, null for a run about nobody. */
export type OptionalMemorySubject = MemorySubject | null

/** An optional snapshot: null for a customer with nothing remembered. */
export type OptionalSnapshot = LeadMemorySnapshot | null

/** An optional step outcome: null when the node has none in the run. */
export type OptionalStepMemory = StepMemory | null

/** The sensitive members each node declared, by namespace and node key, for masking a display read. */
export type SensitiveOf = (namespace: string, nodeKey: string) => Readonly<Record<string, Sensitivity>>
