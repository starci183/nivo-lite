import { Injectable } from "@nestjs/common"
import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { NodeStepRef } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { isNodeMode, type NodeMode, type NodeRequest, type NodeRequestAccount, type NodeRequestsGate } from "@modules/domain/tools"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsError } from "./errors/agent-graphs.error"

/** What a step's node asks for, or null when its version or its node cannot be read. */
type OptionalNodeRequest = NodeRequest | null

/** The node a step runs, or null when its pinned version does not hold it. */
type OptionalNode = GraphSpecNode | null

/**
 * The node's declared mode, read as written: its `mode` member (the ONE truth: the template adapter writes it on every node step); else,
 * on a stored node from before the member, the mode its accounts' legacy `operations` state (`ask` when one asks, `auto` when all are
 * `auto`); else NONE (absent, or any other word: the engine has no default).
 */
const modeOfNode = (node: GraphSpecNode): NodeMode | null => {
    if (node.mode !== undefined) return isNodeMode(node.mode) ? node.mode : null
    const stated: ReadonlyArray<unknown> = (node.accounts ?? []).flatMap((account) => Object.values(account.operations ?? {}))
    if (stated.length === 0 || !stated.every((mode) => isNodeMode(mode))) return null
    return stated.includes("ask") ? "ask" : "auto"
}

/** The providers a node lists, in its order (an entry for any provider of a kind names none and is no provider to bind). */
const accountsOfNode = (node: GraphSpecNode): ReadonlyArray<NodeRequestAccount> =>
    (node.accounts ?? []).flatMap((account) =>
        account.provider === null ? [] : [{ kind: account.kind, provider: account.provider, connectionId: account.connectionId }],
    )

@Injectable()
/**
 * The ONE reader of a node's request (nivo-frame `rights`): the version a run is pinned to is read (the agent graph version of a primary
 * workflow, the workflow version of any other), and its node answers its declared `mode`, the providers it lists, in order. A node
 * that states no mode has NO request (null, logged): there is no default mode. A version or a node that cannot be read has none either.
 * It reads the graph store alone, so the gateway may hold it without a ring.
 */
export class AgentNodeRequestsService implements NodeRequestsGate {
    constructor(
        private readonly graphs: AgentGraphsService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The request of the step's node in its pinned version; null when the version is not the agent's, cannot be read, or holds no such node. */
    async requestOf(workspaceId: string, agentId: string, step: NodeStepRef): Promise<OptionalNodeRequest> {
        const node = await this.nodeOf(workspaceId, agentId, step)
        if (node === null) return null
        // An engine control step (`core.call-workflow`, `core.outcome`, `core.for-each`): told by its installed definition's `control`
        // flag (`INSTALLED.stepOf`), never by its id. It declares no mode: its calls are the engine's own.
        if (INSTALLED.stepOf(node.step)?.control === true) return { mode: "auto", accounts: [], control: true }
        const mode = modeOfNode(node)
        if (mode === null) {
            this.logger.warn(AgentGraphsLogEvent.NodeModeUnstated, {
                workspaceId,
                agentId,
                versionId: step.versionId,
                nodeKey: step.nodeKey,
            })
            return null
        }
        return { mode, accounts: accountsOfNode(node) }
    }

    private async nodeOf(workspaceId: string, agentId: string, step: NodeStepRef): Promise<OptionalNode> {
        try {
            const { document } = await this.graphs.versionAt(workspaceId, agentId, step.versionId)
            return document.flow?.nodes.find((node) => node.key === step.nodeKey) ?? null
        } catch (cause) {
            // A version that is not the agent's or no longer reads asks for nothing; any other failure is the caller's to see.
            if (!(cause instanceof AgentGraphsError)) throw cause
            this.logger.warn(AgentGraphsLogEvent.NodeRequestUnreadable, {
                workspaceId,
                agentId,
                versionId: step.versionId,
                nodeKey: step.nodeKey,
                code: cause.code,
            })
            return null
        }
    }
}
