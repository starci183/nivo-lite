import { SdkError } from "../sdk-error"

/** The codes a plan step is refused with when it cannot become DDL text. */
export type RenderErrorCode =
    "ENTITY_RENDER_NAME_INVALID" | "ENTITY_RENDER_VALUE_INVALID" | "ENTITY_RENDER_OP_UNSUPPORTED"

/** Thrown by the render helpers for a name, value or step they refuse to write into SQL; `renderMigration` turns it into a refusal list. */
export class EntityRenderError extends SdkError<RenderErrorCode> {}
