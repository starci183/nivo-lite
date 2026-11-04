import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the graph-nodes capability. */
export enum GraphNodesErrorCode {
    /** A graph names a node the app did not install. */
    NodeUnknown = "GRAPH_NODES_NODE_UNKNOWN",
    /** Two modules registered a port or an executor for the same kind. */
    PortDuplicate = "GRAPH_NODES_PORT_DUPLICATE",
    /** A node read or wrote a kind no module serves. */
    PortMissing = "GRAPH_NODES_PORT_MISSING",
    /** A node ran an effect no module executes. */
    ExecutorMissing = "GRAPH_NODES_EXECUTOR_MISSING",
    /** A node called a tool while no NIVO MCP door is bound. */
    ToolDoorMissing = "GRAPH_NODES_TOOL_DOOR_MISSING",
    /** A node called a capability tool the workspace has no connected provider for: the node turns it into a connect work item. */
    ToolNotConnected = "GRAPH_NODES_TOOL_NOT_CONNECTED",
    /** The provider refused the workspace's connection itself (a scope never given, a 403): only the owner can cure it, so it is not retried. */
    ToolConnectionRefused = "GRAPH_NODES_TOOL_CONNECTION_REFUSED",
    /** The NIVO MCP door refused or failed a node tool call (the reason rides in the params). */
    ToolFailed = "GRAPH_NODES_TOOL_FAILED",
}

/** How each graph-nodes code travels. */
export const GRAPH_NODES_ERROR_KINDS: Record<GraphNodesErrorCode, ErrorKind> = {
    [GraphNodesErrorCode.NodeUnknown]: "not-found",
    [GraphNodesErrorCode.PortDuplicate]: "internal",
    [GraphNodesErrorCode.PortMissing]: "internal",
    [GraphNodesErrorCode.ExecutorMissing]: "internal",
    [GraphNodesErrorCode.ToolDoorMissing]: "internal",
    [GraphNodesErrorCode.ToolNotConnected]: "not-found",
    [GraphNodesErrorCode.ToolConnectionRefused]: "forbidden",
    [GraphNodesErrorCode.ToolFailed]: "unavailable",
}

/** The one error class of the graph-nodes capability. */
export class GraphNodesError extends DomainError<GraphNodesErrorCode> {}
