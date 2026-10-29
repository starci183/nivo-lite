import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the prompt-library integration. */
export enum AiTasksErrorCode {
    /** The model answered twice without a JSON object. */
    JsonNotReturned = "AI_TASKS_JSON_NOT_RETURNED",
    /** The AI endpoint did not answer (rate limited, refused or failed). */
    Unavailable = "AI_TASKS_UNAVAILABLE",
    /** The workspace has used its allowance for this kind of text; the sentence to show rides in the params. */
    QuotaBlocked = "AI_TASKS_QUOTA_BLOCKED",
}

/** How each code travels. */
export const AI_TASKS_ERROR_KINDS: Record<AiTasksErrorCode, ErrorKind> = {
    [AiTasksErrorCode.JsonNotReturned]: "unavailable",
    [AiTasksErrorCode.Unavailable]: "unavailable",
    [AiTasksErrorCode.QuotaBlocked]: "forbidden",
}

/** The one error class of the integration. */
export class AiTasksError extends DomainError<AiTasksErrorCode> {}
