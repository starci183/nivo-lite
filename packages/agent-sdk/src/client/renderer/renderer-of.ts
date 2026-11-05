import type { BlockRenderer } from "./define-renderer"
import { RendererError } from "./renderer-error"

/** The renderer of a block in a package's list; throws `RENDERER_MISSING` (at the block id) when the package lists none. */
export const rendererOf = (renderers: ReadonlyArray<BlockRenderer>, id: string): BlockRenderer => {
    const found = renderers.find((renderer) => renderer.id === id)
    if (found === undefined) throw new RendererError("RENDERER_MISSING", id)
    return found
}
