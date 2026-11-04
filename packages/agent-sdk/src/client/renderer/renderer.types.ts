import type { ActionDefinition, ReadDefinition } from "../../block/block.types"
import type { BlockRenderer } from "./define-renderer"

/** What every node of one drawn spec shares. */
export interface SpecContext {
    /** The component of each registered block, by block id. */
    readonly renderers: ReadonlyMap<string, BlockRenderer>
    /** The reads a node may bind. */
    readonly reads: ReadonlyArray<ReadDefinition>
    /** The actions a node may bind. */
    readonly actions: ReadonlyArray<ActionDefinition>
    /** The message namespace of the module whose workbench is drawn. */
    readonly namespace: string
    /** The installation whose data the reads run against; it fills `$installationId`. */
    readonly installationId: string
}
