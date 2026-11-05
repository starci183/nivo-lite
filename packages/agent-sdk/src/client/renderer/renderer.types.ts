import type { ActionDefinition, ParamHandle, ReadDefinition } from "../../block/block.types"
import type { BlockRenderer } from "./define-renderer"
import type { Pane } from "./view-chrome"

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
    /** The spec params of the drawn spec: what the reads take as `$name` variables and what the blocks read and write. */
    readonly params: ParamHandle
    /** The pane a phone shows when the spec declares a `pane` param; null when it declares none. */
    readonly pane: Pane | null
}
