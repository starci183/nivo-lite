import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { ContactFacts } from "./contacts.contracts"

/** One remembered outcome of a workflow step about a person: the workflow, the step, how it ended, when, and what it answered. */
export interface ContactMemoryNote {
    /** The workflow namespace. */
    readonly workflow: string
    /** The node key of the step. */
    readonly step: string
    /** How it ended. */
    readonly status: string
    /** When, ISO UTC. */
    readonly at: string
    /** What it answered. */
    readonly output: JsonValue
}

/** What the workflows remember of a person: the facts (newest value wins) and the outcomes of their steps. */
export interface ContactMemoryView {
    /** The facts, by name. */
    readonly facts: ContactFacts
    /** The step outcomes, newest first. */
    readonly notes: ReadonlyArray<ContactMemoryNote>
}

/** Who reads the memory: a step reads raw values; a person's screen reads them masked by what each node declared sensitive. */
export type ContactMemoryReader = "step" | "display"

/**
 * The memory of a contact as the contacts store moves it: implemented by the engine's memory store (`lead-memory`), which
 * keys every entry by the contact. A merge moves the loser's entries to the survivor; a deletion of the contact removes none (they stay and are left out of every read).
 */
export interface ContactMemoryPort {
    /** What the workflows remember of the contact. */
    read(workspaceId: string, contactId: string, reader: ContactMemoryReader): Promise<ContactMemoryView>
    /** Lays facts over the contact's facts (newest wins). */
    remember(workspaceId: string, contactId: string, facts: ContactFacts): Promise<void>
    /** Removes the named facts; answers the names that were held. */
    forget(workspaceId: string, contactId: string, facts: ReadonlyArray<string>): Promise<ReadonlyArray<string>>
    /** Moves every entry of `from` to `into` (the survivor's own entries win). */
    rekey(workspaceId: string, from: string, into: string): Promise<void>
}

/** The injection token of the contact memory. */
export const CONTACT_MEMORY: unique symbol = Symbol("CONTACT_MEMORY")
