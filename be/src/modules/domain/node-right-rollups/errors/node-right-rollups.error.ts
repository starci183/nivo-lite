import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the node-right roll-ups. */
export enum NodeRightRollupsErrorCode {
    /** The workspace has no agent with that id. */
    AgentNotFound = "NODE_RIGHT_ROLLUPS_AGENT_NOT_FOUND",
    /** The template has no such version. */
    TemplateVersionNotFound = "NODE_RIGHT_ROLLUPS_TEMPLATE_VERSION_NOT_FOUND",
}

/** How each roll-up code travels. */
export const NODE_RIGHT_ROLLUPS_ERROR_KINDS: Record<NodeRightRollupsErrorCode, ErrorKind> = {
    [NodeRightRollupsErrorCode.AgentNotFound]: "not-found",
    [NodeRightRollupsErrorCode.TemplateVersionNotFound]: "not-found",
}

/** The one error class of the node-right roll-ups. */
export class NodeRightRollupsError extends DomainError<NodeRightRollupsErrorCode> {}
