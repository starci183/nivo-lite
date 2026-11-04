import { SdkError } from "../../sdk-error"

/** Thrown when a block component is handed less than its block declares, which is a bug of the renderer and never of a spec. */
export class RendererError extends SdkError<"RENDERER_SLOTS_MISSING"> {}
