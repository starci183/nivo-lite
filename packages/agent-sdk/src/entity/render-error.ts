import { DomainError } from "@starci/common"

/** The codes a plan step is refused with when it cannot become DDL text. */
export type RenderErrorCode =
    "ENTITY_RENDER_NAME_INVALID" | "ENTITY_RENDER_VALUE_INVALID" | "ENTITY_RENDER_OP_UNSUPPORTED"

/** Thrown by the render helpers for a name, value or step they refuse to write into SQL; `renderMigration` turns it into a refusal list. */
export class EntityRenderError extends DomainError<RenderErrorCode> {
    constructor(code: RenderErrorCode, at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}
