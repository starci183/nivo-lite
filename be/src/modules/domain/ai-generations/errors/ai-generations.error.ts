import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the ai-generations capability. */
export enum AiGenerationsErrorCode {
    /** A text generation did not produce text; the reason and the sentence to show ride in the params. */
    GenerationFailed = "AI_GENERATIONS_FAILED",
    /** The insert answered no row: the generation was not written. */
    NotCreated = "AI_GENERATIONS_NOT_CREATED",
    /** The text asked for is not one of the workspace. */
    GenerationNotFound = "AI_GENERATIONS_NOT_FOUND",
}

/** How each ai-generations code travels. */
export const AI_GENERATIONS_ERROR_KINDS: Record<AiGenerationsErrorCode, ErrorKind> = {
    [AiGenerationsErrorCode.GenerationFailed]: "unavailable",
    [AiGenerationsErrorCode.NotCreated]: "internal",
    [AiGenerationsErrorCode.GenerationNotFound]: "not-found",
}

/** The one error class of the ai-generations capability. */
export class AiGenerationsError extends DomainError<AiGenerationsErrorCode> {}
