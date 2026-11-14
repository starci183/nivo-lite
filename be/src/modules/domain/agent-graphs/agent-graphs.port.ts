import type { FactSpec } from "./agent-graphs.contracts"

/**
 * One module's declaration of the facts a decide point of a graph may name (its key, type, unit and allowed values), which the checks of a
 * graph that is saved or published read. Nothing reads a fact's value: no engine gate walks a graph (2026-11-13).
 */
export interface GraphFactReader {
    /** The facts it declares, with their type, unit and allowed values. */
    readonly facts: ReadonlyArray<FactSpec>
}

/** A file a customer sent with a message, as a node reads it: a short-lived address, never the bytes. */
export interface FlowTriggerFile {
    /** The file. */
    readonly id: string
    /** Its name. */
    readonly name: string
    /** Its type. */
    readonly contentType: string
    /** A short-lived address. */
    readonly url: string
}
