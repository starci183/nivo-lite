import type { FactSpec, FactValue } from "./agent-graphs.contracts"

/** The subject a fact is read about: the record the work item names. */
export interface FactSubject {
    /** The type. */
    readonly type: string
    /** The id. */
    readonly id: string
}

/**
 * One module's reader of the facts a decide point reads from real records (the amount of the supplier payment, not the amount the
 * model wrote). It only reads, in the agent's view, and a fact it cannot read is absent from its answer.
 */
export interface GraphFactReader {
    /** The facts it declares, with their type, unit and allowed values. */
    readonly facts: ReadonlyArray<FactSpec>
    /** Reads the named facts of one subject; a fact that could not be read is left out. */
    read(workspaceId: string, subject: FactSubject, facts: ReadonlyArray<string>): Promise<Readonly<Record<string, FactValue>>>
}
