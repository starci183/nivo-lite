import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent tools capability. */
export enum AgentToolsErrorCode {
    /** The tool token is missing, forged, expired, exhausted or its job has ended. */
    TokenInvalid = "AGENT_TOOLS_TOKEN_INVALID",
    /** The tool is not in the manifest; the tool name rides in the params. */
    UnknownTool = "AGENT_TOOLS_UNKNOWN_TOOL",
    /** A required argument is empty; the field name rides in the params. */
    ArgumentMissing = "AGENT_TOOLS_ARGUMENT_MISSING",
    /** The tool exists but its owner is not wired in this app: the agent is told it cannot be used, nothing is pretended. */
    ToolUnavailable = "AGENT_TOOLS_TOOL_UNAVAILABLE",
}

/** How each agent tools code travels. */
export const AGENT_TOOLS_ERROR_KINDS: Record<AgentToolsErrorCode, ErrorKind> = {
    [AgentToolsErrorCode.TokenInvalid]: "unauthenticated",
    [AgentToolsErrorCode.UnknownTool]: "not-found",
    [AgentToolsErrorCode.ArgumentMissing]: "invalid",
    [AgentToolsErrorCode.ToolUnavailable]: "unavailable",
}

/** The one error class of the agent tools capability. */
export class AgentToolsError extends DomainError<AgentToolsErrorCode> {}
