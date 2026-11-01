import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the workspace-seed capability. */
export enum WorkspaceSeedErrorCode {
    /** The own-auth account door refused an account call. */
    AuthFailed = "WORKSPACE_SEED_AUTH_FAILED",
    /** A write answered no row where it must answer one. */
    RowMissing = "WORKSPACE_SEED_ROW_MISSING",
    /** A command needs the target runner's private input. */
    InputRequired = "WORKSPACE_SEED_INPUT_REQUIRED",
    /** Private input violates the fixed command contract. */
    InputInvalid = "WORKSPACE_SEED_INPUT_INVALID",
    /** A missing Auth account has no initial creation credential. */
    PasswordRequired = "WORKSPACE_SEED_PASSWORD_REQUIRED",
    /** Auth did not authenticate the selected owner or actor. */
    PrincipalInvalid = "WORKSPACE_SEED_PRINCIPAL_INVALID",
    /** A bounded scan cannot establish account absence. */
    ScanIncomplete = "WORKSPACE_SEED_SCAN_INCOMPLETE",
    /** Recovery did not find the complete requested result. */
    VerificationFailed = "WORKSPACE_SEED_VERIFICATION_FAILED",
    /** Creating a missing first owner needs explicit bootstrap authority in the public plan. */
    BootstrapRequired = "WORKSPACE_SEED_BOOTSTRAP_REQUIRED",
    /** Auth did not acknowledge cleanup of the password session this operation owns. */
    SessionCleanupFailed = "WORKSPACE_SEED_SESSION_CLEANUP_FAILED",
    /** A profile connector could not be read: its server did not answer `tools/list`. */
    ConnectorUnreachable = "WORKSPACE_SEED_CONNECTOR_UNREACHABLE",
}

/** How each workspace-seed code travels. */
export const WORKSPACE_SEED_ERROR_KINDS: Record<WorkspaceSeedErrorCode, ErrorKind> = {
    [WorkspaceSeedErrorCode.AuthFailed]: "unavailable",
    [WorkspaceSeedErrorCode.RowMissing]: "internal",
    [WorkspaceSeedErrorCode.InputRequired]: "invalid",
    [WorkspaceSeedErrorCode.InputInvalid]: "invalid",
    [WorkspaceSeedErrorCode.PasswordRequired]: "invalid",
    [WorkspaceSeedErrorCode.PrincipalInvalid]: "unauthenticated",
    [WorkspaceSeedErrorCode.ScanIncomplete]: "unavailable",
    [WorkspaceSeedErrorCode.VerificationFailed]: "conflict",
    [WorkspaceSeedErrorCode.BootstrapRequired]: "forbidden",
    [WorkspaceSeedErrorCode.SessionCleanupFailed]: "unavailable",
    [WorkspaceSeedErrorCode.ConnectorUnreachable]: "unavailable",
}

/** The one error class of the workspace-seed capability. */
export class WorkspaceSeedError extends DomainError<WorkspaceSeedErrorCode> {}
