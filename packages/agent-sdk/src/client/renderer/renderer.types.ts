import type { ActionDefinition, ReadDefinition } from "../../block/block.types"
import type { BlockRenderer } from "./define-renderer"

/** What every node of one drawn spec shares. */
export interface SpecContext {
    /** The renderers of the installed blocks by block id, used to draw each node's block. */
    readonly renderers: ReadonlyMap<string, BlockRenderer>
    /** The reads registered by the installed modules, looked up by a node's read binding. */
    readonly reads: ReadonlyArray<ReadDefinition>
    /** The actions registered by the installed modules, looked up by a node's action binding. */
    readonly actions: ReadonlyArray<ActionDefinition>
    /** The message namespace of the module whose workbench is drawn. */
    readonly namespace: string
    /** The installation the workbench is drawn for; it replaces `$installationId` in read variables. */
    readonly installationId: string
}
