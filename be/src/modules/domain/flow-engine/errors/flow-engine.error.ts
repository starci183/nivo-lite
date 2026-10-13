import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the flow engine capability. */
export enum FlowEngineErrorCode {
    /** A command input is missing or has the wrong shape; the field rides in the params. */
    InvalidPayload = "FLOW_ENGINE_INVALID_PAYLOAD",
    /** The action can never run alone, so it cannot be set to auto; the action rides in the params. */
    ModeCapped = "FLOW_ENGINE_MODE_CAPPED",
}

/** How each flow engine code travels. */
export const FLOW_ENGINE_ERROR_KINDS: Record<FlowEngineErrorCode, ErrorKind> = {
    [FlowEngineErrorCode.InvalidPayload]: "invalid",
    [FlowEngineErrorCode.ModeCapped]: "invalid",
}

/** The one error class of the flow engine capability. */
export class FlowEngineError extends DomainError<FlowEngineErrorCode> {}
