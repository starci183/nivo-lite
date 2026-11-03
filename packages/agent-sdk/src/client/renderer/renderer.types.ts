import type { ActionDefinition, ReadDefinition } from "../../block/block.types"
import type { BlockRenderer } from "./define-renderer"

/** What every node of one drawn spec shares. */
export interface SpecContext {
    readonly renderers: ReadonlyMap<string, BlockRenderer>
    readonly reads: ReadonlyArray<ReadDefinition>
    readonly actions: ReadonlyArray<ActionDefinition>
    /** The message namespace of the module whose workbench is drawn. */
    readonly namespace: string
    readonly installationId: string
}
