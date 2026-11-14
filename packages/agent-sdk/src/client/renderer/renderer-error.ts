import { DomainError } from "@starci/common"

/**
 * Thrown when a block component is handed less than its block declares (`RENDERER_SLOTS_MISSING`, a bug of the renderer and never of
 * a spec), or when the client entry of an installed package does not list the renderer of one of its blocks (`RENDERER_MISSING`, a
 * bug of the package).
 */
export class RendererError extends DomainError<"RENDERER_SLOTS_MISSING" | "RENDERER_MISSING"> {
    constructor(code: "RENDERER_SLOTS_MISSING" | "RENDERER_MISSING", at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}
