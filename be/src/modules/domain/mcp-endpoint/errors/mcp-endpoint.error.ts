import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the outbound MCP endpoint. */
export enum McpEndpointErrorCode {
    /** The key acts for another workspace than the endpoint path names. */
    WorkspaceMismatch = "MCP_ENDPOINT_WORKSPACE_MISMATCH",
    /** The key was revoked, or its holder left the workspace, after the request was admitted. */
    KeyGone = "MCP_ENDPOINT_KEY_GONE",
}

/** How each code travels. */
export const MCP_ENDPOINT_ERROR_KINDS: Record<McpEndpointErrorCode, ErrorKind> = {
    [McpEndpointErrorCode.WorkspaceMismatch]: "forbidden",
    [McpEndpointErrorCode.KeyGone]: "unauthenticated",
}

/** The one error class of the outbound MCP endpoint. */
export class McpEndpointError extends DomainError<McpEndpointErrorCode> {}
