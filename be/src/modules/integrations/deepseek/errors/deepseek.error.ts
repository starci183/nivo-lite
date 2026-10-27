import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the prompt-library integration. */
export enum DeepseekErrorCode {
    /** The model answered twice without a JSON object. */
    JsonNotReturned = "DEEPSEEK_JSON_NOT_RETURNED",
    /** No key, provider or model of the AI pool answered (no healthy key, rate limited, every lane failed). */
    Unavailable = "DEEPSEEK_UNAVAILABLE",
    /** The workspace has used its allowance for this kind of text; the sentence to show rides in the params. */
    QuotaBlocked = "DEEPSEEK_QUOTA_BLOCKED",
}

/** How each code travels. */
export const DEEPSEEK_ERROR_KINDS: Record<DeepseekErrorCode, ErrorKind> = {
    [DeepseekErrorCode.JsonNotReturned]: "unavailable",
    [DeepseekErrorCode.Unavailable]: "unavailable",
    [DeepseekErrorCode.QuotaBlocked]: "forbidden",
}

/** The one error class of the integration. */
export class DeepseekError extends DomainError<DeepseekErrorCode> {}
