import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the MCP gateway. */
export enum McpGatewayErrorCode {
    /** The connector has no such tool. */
    UnknownTool = "MCP_GATEWAY_UNKNOWN_TOOL",
    /** The input of a console command is not valid. */
    Invalid = "MCP_GATEWAY_INVALID",
    /** The agent is not one of the workspace. */
    AgentNotFound = "MCP_GATEWAY_AGENT_NOT_FOUND",
    /** The remote connector takes a credential and none is sealed in its row yet. */
    CredentialMissing = "MCP_GATEWAY_CREDENTIAL_MISSING",
    /** The sealed credential of the connector cannot be opened with the current key. */
    CredentialUnreadable = "MCP_GATEWAY_CREDENTIAL_UNREADABLE",
    /** The native adapter did not answer within the time limit. */
    Timeout = "MCP_GATEWAY_TIMEOUT",
    /** The agent's credential acts for another workspace than the endpoint it called. */
    WorkspaceMismatch = "MCP_GATEWAY_WORKSPACE_MISMATCH",
    /** The connector's catalog was not read, or changed since it was shown, so it cannot be approved as it is. */
    CatalogChanged = "MCP_GATEWAY_CATALOG_CHANGED",
}

/** How each code travels. */
export const MCP_GATEWAY_ERROR_KINDS: Record<McpGatewayErrorCode, ErrorKind> = {
    [McpGatewayErrorCode.UnknownTool]: "not-found",
    [McpGatewayErrorCode.Invalid]: "invalid",
    [McpGatewayErrorCode.AgentNotFound]: "not-found",
    [McpGatewayErrorCode.CredentialMissing]: "unavailable",
    [McpGatewayErrorCode.CredentialUnreadable]: "internal",
    [McpGatewayErrorCode.Timeout]: "unavailable",
    [McpGatewayErrorCode.WorkspaceMismatch]: "forbidden",
    [McpGatewayErrorCode.CatalogChanged]: "conflict",
}

/** The one error class of the gateway. */
export class McpGatewayError extends DomainError<McpGatewayErrorCode> {}
