import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the tools registry. */
export enum ToolsErrorCode {
    /** The connector has no such tool. */
    UnknownTool = "TOOLS_UNKNOWN_TOOL",
    /** The input of a console command is not valid. */
    Invalid = "TOOLS_INVALID",
    /** A tool call does not match its bounded argument schema. */
    InvalidArguments = "TOOLS_INVALID_ARGUMENTS",
    /** The agent is not one of the workspace. */
    AgentNotFound = "TOOLS_AGENT_NOT_FOUND",
    /** The native adapter did not answer within the time limit. */
    Timeout = "TOOLS_TIMEOUT",
    /** A native adapter refused an expected case (`not_connected`, `internal_only`): an answer to the caller, never a failure of the connector. */
    NativeRefused = "TOOLS_NATIVE_REFUSED",
    /** An agent's attachment to a provider, or an ability on it, cannot be changed as asked; `reason` says why. */
    AttachmentRefused = "TOOLS_ATTACHMENT_REFUSED",
    /**
     * A step's call needs an account of a provider of which the agent holds several, and neither the run's trigger, nor the run's earlier
     * calls, nor the agent's default account of the provider names one: the owner picks a default. `provider` and `connectionIds` (the
     * candidate accounts, comma separated) ride in the params; nothing was sent.
     */
    AccountNeedsPick = "TOOLS_ACCOUNT_NEEDS_PICK",
}

/** How each code travels. */
export const TOOLS_ERROR_KINDS: Record<ToolsErrorCode, ErrorKind> = {
    [ToolsErrorCode.UnknownTool]: "not-found",
    [ToolsErrorCode.Invalid]: "invalid",
    [ToolsErrorCode.InvalidArguments]: "invalid",
    [ToolsErrorCode.AgentNotFound]: "not-found",
    [ToolsErrorCode.Timeout]: "unavailable",
    [ToolsErrorCode.NativeRefused]: "forbidden",
    [ToolsErrorCode.AttachmentRefused]: "invalid",
    [ToolsErrorCode.AccountNeedsPick]: "conflict",
}

/** The one error class of the gateway. */
export class ToolsError extends DomainError<ToolsErrorCode> {}
