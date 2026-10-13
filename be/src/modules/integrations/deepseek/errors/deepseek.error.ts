import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the prompt-library integration. */
export enum DeepseekErrorCode {
    /** The model answered twice without a JSON object. */
    JsonNotReturned = "DEEPSEEK_JSON_NOT_RETURNED",
}

/** How each code travels. */
export const DEEPSEEK_ERROR_KINDS: Record<DeepseekErrorCode, ErrorKind> = {
    [DeepseekErrorCode.JsonNotReturned]: "unavailable",
}

/** The one error class of the integration. */
export class DeepseekError extends DomainError<DeepseekErrorCode> {}
