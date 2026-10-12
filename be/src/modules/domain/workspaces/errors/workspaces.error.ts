import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the workspaces capability. */
export enum WorkspacesErrorCode {
    /** Creating a free workspace is switched off in this environment. */
    SignupDisabled = "WORKSPACES_SIGNUP_DISABLED",
}

/** How each workspaces code travels. */
export const WORKSPACES_ERROR_KINDS: Record<WorkspacesErrorCode, ErrorKind> = {
    [WorkspacesErrorCode.SignupDisabled]: "forbidden",
}

/** The one error class of the workspaces capability. */
export class WorkspacesError extends DomainError<WorkspacesErrorCode> {}
