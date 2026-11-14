/** How far an agent may use a tool: alone, after a person approves, or not at all (the default). */
export type GrantMode = "auto" | "ask"

/** A numeric argument constraint of a grant: the argument `arg` runs alone up to `max`. */
export interface ArgConstraint {
    /** The tool argument, for example "quantity" of shop.order.place. */
    readonly arg: string
    /** The largest value allowed without a person. */
    readonly max: number
}

/** One grant row of an agent as the gateway reads it. */
export interface ToolGrantView {
    /** The full tool name or `connector.*`. */
    readonly tool: string
    /** `auto`, `ask` or `never`. */
    readonly mode: string
    /** The amount limit (bigint text from the driver), or null. */
    readonly limit_vnd: string | number | null
    /** The argument constraints (a JSON array). */
    readonly constraints: unknown
}

/** One grant row of a workspace with its agent. */
export interface WorkspaceGrantView extends ToolGrantView {
    /** The agent. */
    readonly agent_id: string
    /** The agent name. */
    readonly agent_name: string
}

/** One attachment: an agent of a workspace attached to one connected account (a connection). Detaching it is the kill switch. */
export interface ProviderAttachmentRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent; it must be one of the workspace. */
    readonly agentId: string
    /** The connected account: the connection row. */
    readonly connectionId: string
    /** The provider of that connection. */
    readonly provider: string
}

/** One attachment as the gateway reads it. */
export interface ProviderAttachmentView {
    /** The agent. */
    readonly agentId: string
    /** The connected account. */
    readonly connectionId: string
    /** The provider of that account. */
    readonly provider: string
}

/** Where a node policy row came from: a template's proposal the owner agreed, the owner's own edit, or the move from the agent's ticks. */
export type NodePolicyOrigin = "template" | "owner" | "migration"

/** The node of an agent's workflow a policy row belongs to. */
export interface NodePolicyNode {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The workflow of the agent. */
    readonly workflowId: string
    /** The key of the node within the workflow's graph. */
    readonly nodeKey: string
}

/** What tells one node policy row from another: the workspace, the agent, its workflow, the node, the account and the operation. */
export type NodeAccountPolicyKey = Pick<
    NodeAccountPolicyRecord,
    "workspaceId" | "agentId" | "workflowId" | "nodeKey" | "connectionId" | "operation"
>

/** One node policy row: the node may call one operation on one connected account, in a mode. */
export interface NodeAccountPolicyRecord extends NodePolicyNode {
    /** The connected account. */
    readonly connectionId: string
    /** The operation: the full tool id. */
    readonly operation: string
    /** `auto` (the node calls it by itself) or `ask` (each call waits for a person). */
    readonly mode: GrantMode
    /** Where the row came from. */
    readonly origin: NodePolicyOrigin
    /** The workflow version the row was derived from or agreed for, or null. */
    readonly fromVersionId: string | null
    /** The member who agreed it, or null for a row no person agreed one by one (the move from the ticks). */
    readonly agreedBy: string | null
    /**
     * The place of the account's provider in the node's ordered list of providers (0 = the first). Absent writes 0 (a node of one
     * provider, a road that knows no order). A row that exists keeps its place: only a new row takes it.
     */
    readonly position?: number | undefined
}

/** One node policy row as the gateway reads it. */
export interface NodeAccountPolicyView {
    /** The agent. */
    readonly agentId: string
    /** The workflow. */
    readonly workflowId: string
    /** The node key. */
    readonly nodeKey: string
    /** The connected account. */
    readonly connectionId: string
    /** The operation: the full tool id. */
    readonly operation: string
    /** The mode. */
    readonly mode: GrantMode
    /** Where the row came from. */
    readonly origin: NodePolicyOrigin
}

/**
 * One judged call of the shadow compare, as it is counted: who and where, the tool, and the two decision codes. Ids and codes only:
 * no argument, no text of the call.
 */
export interface ShadowTallyLine {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The road the call came by (`node`, or a road outside every node). */
    readonly originKind: string
    /** The workflow of the step, or null. */
    readonly workflowId: string | null
    /** The node key of the step, or null. */
    readonly nodeKey: string | null
    /** The version the run is pinned to, or null. */
    readonly versionId: string | null
    /** The tool (or the work action) judged. */
    readonly tool: string
    /** What the agent-level rights decided: the decision that was acted on. */
    readonly realCode: string
    /** What the node policy would have decided, or why it was not compared (`outside_node`, `no_workflow`). */
    readonly shadowCode: string
}

/** One line of the shadow report: how often one pair of decisions was seen for a node and tool. */
export interface ShadowTallyView extends Omit<ShadowTallyLine, "versionId"> {
    /** How many calls. */
    readonly calls: number
    /** The pinned version of the latest such call, or null. */
    readonly lastVersionId: string | null
    /** When the first such call was seen. */
    readonly firstAt: Date
    /** When the latest was. */
    readonly lastAt: Date
}

/** Which tallies a report reads. */
export interface ShadowReportQuery {
    /** Only this workspace; absent = every workspace. */
    readonly workspaceId?: string | undefined
    /** The most lines, already bounded by the caller. */
    readonly limit: number
}

/** The switch "node rights decide" of one workspace, as stored. */
export interface NodeRightsSwitchView {
    /** The workspace. */
    readonly workspaceId: string
    /** True when the node's rows decide a call made inside a workflow node. */
    readonly decides: boolean
    /** True when the last flip was forced past a shadow report without full agreement. */
    readonly forced: boolean
    /** The compared calls of the shadow report the last flip read. */
    readonly compared: number
    /** Of them, the ones that differed. */
    readonly differed: number
    /** When it was last flipped, or null for a workspace never flipped. */
    readonly flippedAt: Date | null
}

/** One flip of the switch: the state to store and what the flip read of the shadow compare. */
export interface NodeRightsFlip {
    /** The workspace. */
    readonly workspaceId: string
    /** On (the node's rows decide) or off (the agent's ticks decide, as before). */
    readonly decides: boolean
    /** True when it was turned on past a shadow report without full agreement. */
    readonly forced: boolean
    /** The compared calls of the shadow report read. */
    readonly compared: number
    /** Of them, the ones that differed. */
    readonly differed: number
}

/** One stored tool id that is given its new name: the same tool, under the id it is now declared by (the tool grant rows' re-key). */
export interface OperationMove {
    /** The id the rows hold. */
    readonly from: string
    /** The id the operation is declared by now. */
    readonly to: string
}

/** What re-keying the rows of one store came to. */
export interface RekeyOutcome {
    /** Rows whose id was changed in place (every other member kept: mode, origin, who agreed and when). */
    readonly rekeyed: number
    /** Rows removed because the same holder already held the operation under its new id (the row under the new id is kept as it is). */
    readonly merged: number
}

/** One tool grant row as the re-key reads it: whose it is and the tool (or `prefix.*`) it names. */
export interface ToolGrantKey {
    /** The agent. */
    readonly agentId: string
    /** The full tool name or `connector.*`. */
    readonly tool: string
}
