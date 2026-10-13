import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the workspace-seed capability. */
export enum WorkspaceSeedErrorCode {
    /** Supabase Auth refused an account call. */
    AuthFailed = "WORKSPACE_SEED_AUTH_FAILED",
    /** A write answered no row where it must answer one. */
    RowMissing = "WORKSPACE_SEED_ROW_MISSING",
}

/** How each workspace-seed code travels. */
export const WORKSPACE_SEED_ERROR_KINDS: Record<WorkspaceSeedErrorCode, ErrorKind> = {
    [WorkspaceSeedErrorCode.AuthFailed]: "unavailable",
    [WorkspaceSeedErrorCode.RowMissing]: "internal",
}

/** The one error class of the workspace-seed capability. */
export class WorkspaceSeedError extends DomainError<WorkspaceSeedErrorCode> {}
