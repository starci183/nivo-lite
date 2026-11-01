import type { FactSpec, FactValues } from "./agent-graphs.contracts"

/** The subject a fact is read about: the record the work item names, and the work item itself. */
export interface FactSubject {
    /** The type. */
    readonly type: string
    /** The id of the record, or an empty text when the work item names none. */
    readonly id: string
    /** The work item the decision is about, for a fact that lives in what the item proposes and not in a record of its own. */
    readonly workItemId: string
    /** The amount in dong the work item proposes, for the facts that are the amount of the work itself (an order, a quote, a discount). */
    readonly amountVnd?: number | null | undefined
}

/**
 * One module's reader of the facts a decide point reads from real records (the amount of the supplier payment, not the amount the
 * model wrote). It only reads, in the agent's view, and a fact it cannot read is absent from its answer.
 */
export interface GraphFactReader {
    /** The facts it declares, with their type, unit and allowed values. */
    readonly facts: ReadonlyArray<FactSpec>
    /** Reads the named facts of one subject; a fact that could not be read is left out. */
    read(workspaceId: string, subject: FactSubject, facts: ReadonlyArray<string>): Promise<FactValues>
}
