import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-plugins capability. */
export enum AgentPluginsErrorCode {
    /** Two plug-ins carry the same key. */
    KeyDuplicate = "AGENT_PLUGINS_KEY_DUPLICATE",
}

/** How each agent-plugins code travels. */
export const AGENT_PLUGINS_ERROR_KINDS: Record<AgentPluginsErrorCode, ErrorKind> = {
    [AgentPluginsErrorCode.KeyDuplicate]: "internal",
}

/** The one error class of the agent-plugins capability. */
export class AgentPluginsError extends DomainError<AgentPluginsErrorCode> {}
