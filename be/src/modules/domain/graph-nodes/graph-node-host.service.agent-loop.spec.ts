import { Test } from "@nestjs/testing"
import type { NodeAgentLoop, NodeHostPorts } from "@nivo-lite/agent-sdk/node"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import {
    PROBE_MODEL,
    PROBE_RUN as INPUT,
    armGraphNodeDoubles,
    readingPort,
    type GraphNodeDoubles,
} from "@tests/fixtures/builders/graph-nodes.builder"
import { CAN_YOU_MAKE_THIS_VI } from "@tests/fixtures/i18n/graph-nodes-spec.messages"
import { GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import { GraphNodeHostService } from "./graph-node-host.service"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GraphNodeRunTokensService } from "./graph-node-run-tokens.service"
import {
    GRAPH_NODES_OPTIONS,
    GRAPH_NODE_AGENT_LOOPS,
    GRAPH_NODE_MODEL,
    GRAPH_NODE_TOOL_DOOR,
} from "./graph-nodes.decorators"
import type { NodeAgentLoops, NodeModelDoor, NodeRunInput, NodeToolDoor } from "./graph-nodes.contracts"

const NOW = "2026-11-04T10:00:00.000Z"

/** A typed partial-text matcher, so it flows into any slot. */
const containing = (text: string): unknown => expect.stringContaining(text)

/** What a call threw, or undefined when it returned. */
const thrownBy = (act: () => void): unknown => {
    try {
        act()
        return undefined
    } catch (error) {
        return error
    }
}

/** Arms a host whose model door also runs agent turns and inlines pictures, and its prebuilt loop. */
const armLoopDoubles = (doubles: GraphNodeDoubles, loops: ReturnType<typeof mock<NodeAgentLoops>>): void => {
    armGraphNodeDoubles(doubles, readingPort())
    doubles.ai.nodeAgentTurns.mockReturnValue({ toolChoice: "auto" })
    doubles.ai.nodeImages.mockResolvedValue(["data:image/png;base64,AAAA"])
    loops.run.mockResolvedValue({ turns: 1 })
}

/** The host with the prebuilt loop bound and the `AGENT_LOOP` flag naming `nodes`. */
const buildWithLoop = async (nodes: ReadonlyArray<string>) => {
    const registry = mock<GraphNodeRegistryService>()
    const effects = mock<GraphNodeEffectsService>()
    const ai = mock<Required<NodeModelDoor>>()
    const tokens = mock<GraphNodeRunTokensService>()
    const tools = mock<NodeToolDoor>({ run: undefined })
    const loops = mock<NodeAgentLoops>()
    armLoopDoubles({ registry, effects, ai, tokens, tools }, loops)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: tools },
            { provide: GRAPH_NODES_OPTIONS, useValue: { agentLoop: { nodes } } },
            { provide: GRAPH_NODE_AGENT_LOOPS, useValue: loops },
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService), ai, loops, registry }
}

/** The host with the `AGENT_LOOP` flag naming `nodes` and no prebuilt loop bound. */
const buildWithoutLoop = async (nodes: ReadonlyArray<string>) => {
    const registry = mock<GraphNodeRegistryService>()
    const effects = mock<GraphNodeEffectsService>()
    const ai = mock<Required<NodeModelDoor>>()
    const tokens = mock<GraphNodeRunTokensService>()
    const tools = mock<NodeToolDoor>({ run: undefined })
    armLoopDoubles({ registry, effects, ai, tokens, tools }, mock<NodeAgentLoops>())
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: tools },
            { provide: GRAPH_NODES_OPTIONS, useValue: { agentLoop: { nodes } } },
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService) }
}

/** Runs the node `nodeId` with a wrapper that only looks at the ports the node runs on. */
const portsSeenBy = async (host: GraphNodeHostService, nodeId: string, extra: Partial<NodeRunInput> = {}) => {
    const seen: Array<NodeHostPorts> = []
    await host.run({
        ...INPUT,
        nodeId,
        ...extra,
        replay: (ports) => {
            seen.push(ports)
            return ports
        },
    })
    return seen[0]
}

describe("GraphNodeHostService AGENT_LOOP", () => {
    it("gives a node the flag names the prebuilt loop, and leaves every other node on the JSON loop", async () => {
        const { host } = await buildWithLoop(["core.probe"])

        expect((await portsSeenBy(host, "core.probe"))?.agent).toEqual(expect.any(Function))
        expect((await portsSeenBy(host, "core.other"))?.agent).toBeUndefined()
    })

    it("gives no node the port with the flag unset, even where the loop is bound: the JSON loop exactly as before", async () => {
        const { host, loops } = await buildWithLoop([])

        expect((await portsSeenBy(host, "core.probe"))?.agent).toBeUndefined()
        expect(loops.run).not.toHaveBeenCalled()
    })

    it("runs the loop on the model door's agent turns, with the pictures inlined and the engine's record of the turns", async () => {
        const { host, ai, loops } = await buildWithLoop(["core.probe"])
        const record = jest.fn()
        const ports = await portsSeenBy(host, "core.probe", { record })
        const loop = mock<NodeAgentLoop>({ purpose: "core.probe:agent", reasoning: "off", images: ["https://x/p.png"] })

        await expect(ports?.agent?.(loop)).resolves.toEqual({ turns: 1 })

        const scope = { workspaceId: "ws-1", locale: "vi", model: PROBE_MODEL }
        expect(ai.nodeImages).toHaveBeenCalledWith(scope, ["https://x/p.png"])
        expect(ai.nodeAgentTurns).toHaveBeenCalledWith(scope, { purpose: "core.probe:agent", reasoning: "off" })
        expect(loops.run).toHaveBeenCalledWith(
            expect.objectContaining({ purpose: "core.probe:agent", images: ["data:image/png;base64,AAAA"] }),
            { toolChoice: "auto" },
            { record },
        )
    })

    it("LIVE IMG (D-MX-4): a picture that could not be read is told to the agent as a fact, never shown as seen", async () => {
        const { host, ai, loops } = await buildWithLoop(["core.probe"])
        const ports = await portsSeenBy(host, "core.probe")
        ai.nodeImages?.mockResolvedValueOnce(["data:image/png;base64,AAAA"])
        const loop = mock<NodeAgentLoop>({
            purpose: "core.probe:agent",
            reasoning: "off",
            images: ["chat-file:ws-1/chat/customer/k-0.png", ""],
            input: { text: CAN_YOU_MAKE_THIS_VI },
        })

        await ports?.agent?.(loop)

        expect(loops.run).toHaveBeenCalledWith(
            expect.objectContaining({
                images: ["data:image/png;base64,AAAA"],
                input: {
                    text: CAN_YOU_MAKE_THIS_VI,
                    picturesNotSeen: { count: 1, note: containing("you have NOT seen them") },
                },
            }),
            { toolChoice: "auto" },
            {},
        )
    })

    it("hands a loop with no picture on as it is, and passes no record when the engine gave none", async () => {
        const { host, ai, loops } = await buildWithLoop(["core.probe"])
        const ports = await portsSeenBy(host, "core.probe")
        const loop = mock<NodeAgentLoop>({ purpose: "core.probe:agent", reasoning: undefined, images: undefined })

        await ports?.agent?.(loop)

        expect(ai.nodeImages).not.toHaveBeenCalled()
        expect(ai.nodeAgentTurns).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi", model: PROBE_MODEL },
            { purpose: "core.probe:agent" },
        )
        expect(loops.run).toHaveBeenCalledWith(loop, { toolChoice: "auto" }, {})
    })
})

describe("GraphNodeHostService AGENT_LOOP flag check", () => {
    it("refuses to start when the flag names a node that is not installed, or names nodes where no loop is bound", async () => {
        const unknown = await buildWithLoop(["core.nowhere"])
        expect(thrownBy(() => unknown.host.onModuleInit())).toMatchObject({
            code: GraphNodesErrorCode.AgentLoopFlagInvalid,
            params: { name: "core.nowhere" },
        })

        const unbound = await buildWithoutLoop(["core.probe"])
        expect(thrownBy(() => unbound.host.onModuleInit())).toMatchObject({ code: GraphNodesErrorCode.AgentLoopFlagInvalid })

        const fine = await buildWithLoop(["core.probe"])
        expect(() => fine.host.onModuleInit()).not.toThrow()
        const off = await buildWithoutLoop([])
        expect(() => off.host.onModuleInit()).not.toThrow()
    })

    it("takes a TEMPLATE node the flag names (every business step since the flip), read through the one installed-step view", async () => {
        // `sales.consult-turn` is a template node (`defineTemplateNode`): no `defineNode` index holds it.
        const template = await buildWithLoop(["sales.consult-turn"])
        expect(() => template.host.onModuleInit()).not.toThrow()
        // Naming it still needs the loop and the model's agent turns bound.
        const unbound = await buildWithoutLoop(["sales.consult-turn"])
        expect(thrownBy(() => unbound.host.onModuleInit())).toMatchObject({ code: GraphNodesErrorCode.AgentLoopFlagInvalid })
    })
})
