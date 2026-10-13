import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the brain-lessons capability. */
export enum BrainLessonsErrorCode {
    /** A lesson needs a title and what to do. */
    Incomplete = "BRAIN_LESSONS_INCOMPLETE",
    /** The lesson is not waiting for a decision. */
    NotProposed = "BRAIN_LESSONS_NOT_PROPOSED",
    /** The lesson is not in force. */
    NotActive = "BRAIN_LESSONS_NOT_ACTIVE",
}

/** How each brain-lessons code travels. */
export const BRAIN_LESSONS_ERROR_KINDS: Record<BrainLessonsErrorCode, ErrorKind> = {
    [BrainLessonsErrorCode.Incomplete]: "invalid",
    [BrainLessonsErrorCode.NotProposed]: "conflict",
    [BrainLessonsErrorCode.NotActive]: "conflict",
}

/** The one error class of the brain-lessons capability. */
export class BrainLessonsError extends DomainError<BrainLessonsErrorCode> {}
