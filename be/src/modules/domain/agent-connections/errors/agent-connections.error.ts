import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-connections capability. */
export enum AgentConnectionsErrorCode {
    /** The agent or the connection of a binding is not in the workspace. */
    TargetNotFound = "AGENT_CONNECTIONS_TARGET_NOT_FOUND",
    /** Another agent of the same role already answers the channel connection: each channel has exactly one agent per role. */
    ChannelOwned = "AGENT_CONNECTIONS_CHANNEL_OWNED",
    /** Resuming a paused agent would give a channel two agents of one role; the caller chooses whom to keep. */
    ResumeConflict = "AGENT_CONNECTIONS_RESUME_CONFLICT",
    /** A manager acts on an agent outside the rooms and roles they manage. */
    OutOfScope = "AGENT_CONNECTIONS_OUT_OF_SCOPE",
}

/** How each agent-connections code travels. */
export const AGENT_CONNECTIONS_ERROR_KINDS: Record<AgentConnectionsErrorCode, ErrorKind> = {
    [AgentConnectionsErrorCode.TargetNotFound]: "not-found",
    [AgentConnectionsErrorCode.ChannelOwned]: "conflict",
    [AgentConnectionsErrorCode.ResumeConflict]: "conflict",
    [AgentConnectionsErrorCode.OutOfScope]: "forbidden",
}

/** The one error class of the agent-connections capability. */
export class AgentConnectionsError extends DomainError<AgentConnectionsErrorCode> {}
