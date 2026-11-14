/** One step outcome the engine remembers about a person, as the contacts page shows the work of the agents. */
export interface ContactWorkRow {
    /** The memory entry's id. */
    readonly id: string
    /** The workflow namespace (`<module>.<workflow key>`): a key, never a label. */
    readonly namespace: string
    /** The node key of the step in its graph (`talk[r2].opening` inside a loop). */
    readonly nodeKey: string
    /** The id of the SDK step the node runs, or null when the entry does not say. */
    readonly step: string | null
    /** How it ended: `done`, `failed` or `passed_over`. */
    readonly status: string
    /** When it ended (ISO text). */
    readonly at: string
    /** The agent whose step wrote it, or null. */
    readonly agentId: string | null
    /** The workflow of the run, or null. */
    readonly workflowId: string | null
    /** The run, or null. */
    readonly runId: string | null
}

/** The step outcomes of one person (public.contact_memory), newest first. */
export interface ContactWorkStore {
    /** The step outcomes under one subject key (the contact's), newest first, at most `limit`; an entry of a deleted contact is left out. */
    recentOf(workspaceId: string, subjectKey: string, limit: number): Promise<ReadonlyArray<ContactWorkRow>>
}

/** The injection token of the contact work store. */
export const CONTACT_WORK_STORE: unique symbol = Symbol("CONTACT_WORK_STORE")
