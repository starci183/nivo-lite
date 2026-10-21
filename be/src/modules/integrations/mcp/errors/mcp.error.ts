import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the MCP integration. */
export enum McpErrorCode {
    /** The remote server did not answer within the time limit. */
    Timeout = "MCP_TIMEOUT",
    /** The remote server could not be reached or answered outside the protocol. */
    Unavailable = "MCP_UNAVAILABLE",
    /** The credential a connector names is not one this integration holds. */
    CredentialMissing = "MCP_CREDENTIAL_MISSING",
}

/** How each code travels. */
export const MCP_ERROR_KINDS: Record<McpErrorCode, ErrorKind> = {
    [McpErrorCode.Timeout]: "unavailable",
    [McpErrorCode.Unavailable]: "unavailable",
    [McpErrorCode.CredentialMissing]: "unavailable",
}

/** The one error class of the MCP integration. */
export class McpError extends DomainError<McpErrorCode> {}
