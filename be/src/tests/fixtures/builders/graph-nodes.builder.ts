import { mock } from "@starci/jest-preset"
import { callDigestOf, nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import {
    flatEffect,
    lookTool,
    lostEffect,
    pingEffect,
    probeNode,
    swallowNode,
    unflatEffect,
    unpingEffect,
} from "@nivo-lite/agent-sdk/testing"
import { ENGINE_CORE_MODEL } from "@nivo-lite/agent-sdk/models"
import {
    GraphNodeEffectsService,
    GraphNodeRegistryService,
    GraphNodeRunTokensService,
    GraphNodesError,
    GraphNodesErrorCode,
    type NodeDataPort,
    type NodeEffectExecutor,
    type NodeModelDoor,
    type NodeRunInput,
    type NodeToolDoor,
} from "@modules/domain/graph-nodes"

/** The subject resolvers the registry answers. */
type SubjectResolvers = ReturnType<GraphNodeRegistryService["subjectResolvers"]>

/** The installed index of the host specs: the probe and swallowing nodes, their effects and the look tool. */
export const PROBE_INSTALL: ReturnType<typeof nodeIndexOf> = nodeIndexOf({
    nodes: [probeNode, swallowNode],
    effects: [pingEffect, unpingEffect, lostEffect, flatEffect, unflatEffect],
    tools: [lookTool],
    dataKinds: [],
})

/** The refusal of a door for a call that waits for a person. */
export const probeAskOf = (): GraphNodesError =>
    new GraphNodesError({
        code: GraphNodesErrorCode.ToolApprovalRequired,
        params: { tool: "core.look", fingerprint: "f" },
    })

/** The probe node's run: no write, the look tool, in Vietnamese. */
export const PROBE_RUN: NodeRunInput = {
    nodeId: "core.probe",
    params: {},
    input: { write: false },
    turn: { turnId: "t-1", workspaceId: "ws-1", agentId: "a-1", subject: null, conversationId: "c-1", locale: "vi" },
    grant: { tools: ["core.look"] },
    key: "run-1:node",
}

/** A data port that reads no rows and has no write. */
export const readingPort = (): NodeDataPort => ({ kind: "record", read: () => Promise.resolve([]) })

/** The key of the probe's one effect call: the step, then the digest of the effect and its arguments. */
export const PROBE_PING_KEY: string = `run-1:node:${callDigestOf("core.ping", { n: 1 })}`

/** A node's model as blocks-core declares it: the model, its weight and where the choice came from. */
export interface NodeModelDeclaration {
    readonly model: string
    readonly weight: string
    readonly source: string
}

/** The model of the probe node: blocks-core declares nothing for it, so the default (a node the table does not know weighs heavy). */
export const PROBE_MODEL: NodeModelDeclaration = { model: "claude-sonnet-5-5", weight: "heavy", source: "default" }

/** The engine core's model as blocks-core declares it, in either position of its ALL_NODES_ON_CLAUDE switch. */
export const CORE_MODEL: NodeModelDeclaration = { model: ENGINE_CORE_MODEL.model, weight: "heavy", source: "declared" }

/**
 * The doubles of the host's ports: the registry answers the probe install, `port` for the `record` kind and an executor of `core.ping`;
 * the ledger runs each effect; the model door answers "hi" and `{ n: 2 }`; the run tokens mint `token-1`; the tool door answers `seen`.
 */
/** The doubles of a node host a spec makes in place (`mock(...)`), for `armGraphNodeDoubles` to arm. */
export interface GraphNodeDoubles {
    /** The node registry. */
    readonly registry: ReturnType<typeof mock<GraphNodeRegistryService>>
    /** The effect ledger. */
    readonly effects: ReturnType<typeof mock<GraphNodeEffectsService>>
    /** The model door. */
    readonly ai: ReturnType<typeof mock<Required<NodeModelDoor>>>
    /** The run tokens. */
    readonly tokens: ReturnType<typeof mock<GraphNodeRunTokensService>>
    /** The tool door. */
    readonly tools: ReturnType<typeof mock<NodeToolDoor>>
}

/**
 * Arms the doubles of a node host: the registry answers the probe node with `port` for its `record` kind, the ledger runs every act,
 * the model door and the tool door answer the probe. Answers the probe's effect executor.
 */
export const armGraphNodeDoubles = (
    doubles: GraphNodeDoubles,
    port: NodeDataPort,
    resolvers: SubjectResolvers = [],
): ReturnType<typeof mock<NodeEffectExecutor>> => {
    const { registry, effects, ai, tokens, tools } = doubles
    registry.installed.mockReturnValue(PROBE_INSTALL)
    registry.subjectResolvers.mockReturnValue(resolvers)
    registry.nodeOf.mockReturnValue(probeNode)
    registry.portOf.mockReturnValue(port)
    const executor = mock<NodeEffectExecutor>({ effect: "core.ping" })
    executor.execute.mockResolvedValue({ kind: "record", id: "e-1" })
    registry.executorOf.mockReturnValue(executor)
    effects.once.mockImplementation((_workspace, _effect, _call, act) => act())
    ai.nodeText.mockResolvedValue("hi")
    ai.nodeJson.mockResolvedValue({ n: 2 })
    tokens.mint.mockReturnValue("token-1")
    tools.call.mockResolvedValue({ seen: true })
    return executor
}
