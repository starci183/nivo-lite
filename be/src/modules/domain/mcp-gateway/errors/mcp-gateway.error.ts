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
    /** The credential the connector names is not one the gateway holds. */
    CredentialMissing = "MCP_GATEWAY_CREDENTIAL_MISSING",
    /** The native adapter did not answer within the time limit. */
    Timeout = "MCP_GATEWAY_TIMEOUT",
}

/** How each code travels. */
export const MCP_GATEWAY_ERROR_KINDS: Record<McpGatewayErrorCode, ErrorKind> = {
    [McpGatewayErrorCode.UnknownTool]: "not-found",
    [McpGatewayErrorCode.Invalid]: "invalid",
    [McpGatewayErrorCode.AgentNotFound]: "not-found",
    [McpGatewayErrorCode.CredentialMissing]: "unavailable",
    [McpGatewayErrorCode.Timeout]: "unavailable",
}

/** The one error class of the gateway. */
export class McpGatewayError extends DomainError<McpGatewayErrorCode> {}
