import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the responsibilities capability. */
export enum ResponsibilitiesErrorCode {
    /** No lead of the workspace has the requested id. */
    LeadNotFound = "RESPONSIBILITIES_LEAD_NOT_FOUND",
    /** No responsibility of the workspace has the requested id. */
    NotFound = "RESPONSIBILITIES_NOT_FOUND",
    /** The chosen owner is not an agent of the workspace. */
    AgentNotFound = "RESPONSIBILITIES_AGENT_NOT_FOUND",
}

/** How each responsibilities code travels. */
export const RESPONSIBILITIES_ERROR_KINDS: Record<ResponsibilitiesErrorCode, ErrorKind> = {
    [ResponsibilitiesErrorCode.LeadNotFound]: "not-found",
    [ResponsibilitiesErrorCode.NotFound]: "not-found",
    [ResponsibilitiesErrorCode.AgentNotFound]: "not-found",
}

/** The one error class of the responsibilities capability. */
export class ResponsibilitiesError extends DomainError<ResponsibilitiesErrorCode> {}
