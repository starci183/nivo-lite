import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the ai-generations capability. */
export enum AiGenerationsErrorCode {
    /** A text generation did not produce text; the reason and the sentence to show ride in the params. */
    GenerationFailed = "AI_GENERATIONS_FAILED",
    /** The insert answered no row: the generation was not written. */
    NotCreated = "AI_GENERATIONS_NOT_CREATED",
    /** Refuses queued work when the workspace's generation allowance is exhausted. */
    QuotaBlocked = "AI_GENERATIONS_QUOTA_BLOCKED",
    /** Refuses queued work while the configured agent engine cannot accept it. */
    EngineUnavailable = "AI_GENERATIONS_ENGINE_UNAVAILABLE",
}

/** How each ai-generations code travels. */
export const AI_GENERATIONS_ERROR_KINDS: Record<AiGenerationsErrorCode, ErrorKind> = {
    [AiGenerationsErrorCode.GenerationFailed]: "unavailable",
    [AiGenerationsErrorCode.NotCreated]: "internal",
    [AiGenerationsErrorCode.QuotaBlocked]: "forbidden",
    [AiGenerationsErrorCode.EngineUnavailable]: "unavailable",
}

/** The one error class of the ai-generations capability. */
export class AiGenerationsError extends DomainError<AiGenerationsErrorCode> {}
