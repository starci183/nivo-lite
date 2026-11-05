import { createElement, lazy } from "react"
import type { BlockDefinition } from "../../block/block.types"
import type { BlockRenderer } from "./define-renderer"
import { rendererOf } from "./renderer-of"

/**
 * The renderer of a block whose component is downloaded the first time a spec draws it. `load` is a static `import()` of the
 * package's client entry, written by the plugin registry generator and never built from a runtime value; it yields the package's
 * renderers, and the one for the block is drawn. The spec renderer holds a Suspense boundary around every node.
 */
export const lazyRenderer = (
    block: BlockDefinition,
    load: () => Promise<ReadonlyArray<BlockRenderer>>,
): BlockRenderer => {
    const Loaded = lazy(async () => ({ default: rendererOf(await load(), block.id).Component }))
    return { id: block.id, block, Component: (erased) => createElement(Loaded, erased) }
}
