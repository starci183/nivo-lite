import type { JsonValue } from "@nivo-lite/agent-sdk/schema"

/** A JSON object as an entry keeps it: `output` is `{ value }`, an `error` the failure's members. */
export type MemoryJson = Readonly<Record<string, JsonValue>>

/** The members of one memory entry a write sets (every time is ISO UTC). */
export interface ContactMemoryValues {
    /** The unique key in the workspace: subject, namespace, node. */
    readonly entryKey: string
    /** Whom it is about. */
    readonly subjectKey: string
    /** The contact, when the subject is one. */
    readonly contactId: string | null
    /** The conversation the person came from, when known. */
    readonly conversationId: string | null
    /** The workflow namespace. */
    readonly namespace: string
    /** The node key. */
    readonly nodeKey: string
    /** The step id of the node. */
    readonly step: string | null
    /** `done`, `failed`, `passed_over`, `trigger` or `facts`. */
    readonly kind: string
    /** The agent whose step wrote it (attribution). */
    readonly agentId: string | null
    /** The workflow of the run. */
    readonly workflowId: string | null
    /** The run. */
    readonly runId: string | null
    /** The graph version the run ran. */
    readonly versionId: string | null
    /** What it holds, `{ value }`. */
    readonly output: MemoryJson
    /** The failure, or null. */
    readonly error: MemoryJson | null
    /** When the outcome happened. */
    readonly writtenAt: string
    /** When the memory closed, or null. */
    readonly closedAt: string | null
    /** When it goes. */
    readonly expiresAt: string
}

/** One stored entry: its values, its id, the version every write moves and when it last changed. */
export interface ContactMemoryEntry extends ContactMemoryValues {
    /** The row id. */
    readonly id: string
    /** The fence of an update. */
    readonly version: number
    /** When it last changed, ISO UTC. */
    readonly updatedAt: string
}

/** An entry, or null when none holds the key. */
export type OptionalContactMemoryEntry = ContactMemoryEntry | null

/** The members of an entry an update sets; an absent member is left as it is. */
export interface ContactMemoryPatch extends Partial<ContactMemoryValues> {}

/** One transaction of the memory store; every member is scoped to the workspace it names. */
export interface ContactMemoryTx {
    /** The entries under any of the subject keys, in id order, at most `limit`; the entries of a deleted contact are left out (they stay in the table). */
    entriesOf(workspaceId: string, subjectKeys: ReadonlyArray<string>, limit: number): Promise<ReadonlyArray<ContactMemoryEntry>>
    /** The entries one node of one run wrote, in id order, at most `limit`. */
    entriesOfRunNode(workspaceId: string, runId: string, nodeKey: string, limit: number): Promise<ReadonlyArray<ContactMemoryEntry>>
    /** The entry of a key, or null. */
    entryOf(workspaceId: string, entryKey: string): Promise<OptionalContactMemoryEntry>
    /** Writes the entry of its key: a new one, or every member of the one held (its version moves). */
    put(workspaceId: string, values: ContactMemoryValues): Promise<void>
    /** Writes members of an entry at the version read; false when another write moved it first (nothing written). */
    update(workspaceId: string, id: string, expected: number, values: ContactMemoryPatch): Promise<boolean>
    /** Removes the entries. */
    remove(workspaceId: string, ids: ReadonlyArray<string>): Promise<void>
    /** The entries whose retention ran out before `now`, oldest expiry first, at most `limit`. */
    dueBefore(workspaceId: string, now: Date, limit: number): Promise<ReadonlyArray<ContactMemoryEntry>>
}

/** Work run in one transaction of the memory store. */
export type ContactMemoryWork<T> = (tx: ContactMemoryTx) => Promise<T>

/** The memory store of the contacts: runs work in one transaction. */
export interface ContactMemoryStore {
    /** Runs the work in one transaction; a throw rolls every write back. */
    transaction<T>(work: ContactMemoryWork<T>): Promise<T>
}

/** The injection token of the contact memory store. */
export const CONTACT_MEMORY_STORE: unique symbol = Symbol("CONTACT_MEMORY_STORE")
