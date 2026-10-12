import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the responsibilities capability. */
export enum ResponsibilitiesErrorCode {
    /** The customer, the agent or the responsibility is not in the workspace. */
    NotFound = "RESPONSIBILITIES_NOT_FOUND",
}

/** How each responsibilities code travels. */
export const RESPONSIBILITIES_ERROR_KINDS: Record<ResponsibilitiesErrorCode, ErrorKind> = {
    [ResponsibilitiesErrorCode.NotFound]: "not-found",
}

/** The one error class of the responsibilities capability. */
export class ResponsibilitiesError extends DomainError<ResponsibilitiesErrorCode> {}
