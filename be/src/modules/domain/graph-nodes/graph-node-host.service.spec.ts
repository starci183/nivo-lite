import { Test } from "@nestjs/testing"
import type { NodeAgentLoop, NodeHostPorts } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { FakeClock, mock } from "@starci/jest-preset"
import {
    PROBE_READ,
    PROBE_WRITE,
    flatEffect,
    lookTool,
    lostEffect,
    pingEffect,
    probeNode,
    swallowNode,
    unflatEffect,
    unpingEffect,
} from "@nivo-lite/agent-sdk/testing"
import { callDigestOf, nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { CLOCK } from "@modules/platform/clock"
import { workInScope } from "@modules/platform/logging"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
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
import type {
    NodeAgentLoops,
    NodeDataPort,
    NodeEffectExecutor,
    NodeModelDoor,
    NodeRunInput,
    NodeSubjectResolver,
    NodeToolDoor,
} from "./graph-nodes.contracts"
import { ENGINE_CORE_MODEL } from "@nivo-lite/blocks-core"

const INSTALL = nodeIndexOf({
    nodes: [probeNode, swallowNode],
    effects: [pingEffect, unpingEffect, lostEffect, flatEffect, unflatEffect],
    tools: [lookTool],
    dataKinds: [],
})

/** The refusal of a door for a call that waits for a person. */
const askOf = (): GraphNodesError =>
    new GraphNodesError({
        code: GraphNodesErrorCode.ToolApprovalRequired,
        params: { tool: "core.look", fingerprint: "f" },
    })

const INPUT: NodeRunInput = {
    nodeId: "core.probe",
    params: {},
    input: { write: false },
    turn: { turnId: "t-1", workspaceId: "ws-1", agentId: "a-1", subject: null, conversationId: "c-1", locale: "vi" },
    grant: { rights: [PROBE_READ, PROBE_WRITE], tools: ["core.look"] },
    key: "run-1:node",
}

/** The host with every port bound; `port` is what the registry answers for the `record` kind. */
const build = async (port: NodeDataPort, resolvers: ReadonlyArray<NodeSubjectResolver> = []) => {
    const registry = mock<GraphNodeRegistryService>()
    registry.installed.mockReturnValue(INSTALL)
    registry.subjectResolvers.mockReturnValue(resolvers)
    registry.nodeOf.mockReturnValue(probeNode)
    registry.portOf.mockReturnValue(port)
    const executor = mock<NodeEffectExecutor>({ effect: "core.ping" })
    executor.execute.mockResolvedValue({ kind: "record", id: "e-1" })
    registry.executorOf.mockReturnValue(executor)
    const effects = mock<GraphNodeEffectsService>()
    effects.once.mockImplementation((_workspace, _effect, _call, act) => act())
    const ai = mock<NodeModelDoor>()
    ai.nodeText.mockResolvedValue("hi")
    ai.nodeJson.mockResolvedValue({ n: 2 })
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.mint.mockReturnValue("token-1")
    const tools = mock<NodeToolDoor>()
    tools.call.mockResolvedValue({ seen: true })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: tools },
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService), executor, effects, ai, tokens, registry, tools }
}

/** The host where no tool door is bound. */
const buildWithoutDoor = async (port: NodeDataPort) => {
    const registry = mock<GraphNodeRegistryService>()
    registry.installed.mockReturnValue(INSTALL)
    registry.subjectResolvers.mockReturnValue([])
    registry.nodeOf.mockReturnValue(probeNode)
    registry.portOf.mockReturnValue(port)
    const executor = mock<NodeEffectExecutor>({ effect: "core.ping" })
    executor.execute.mockResolvedValue({ kind: "record", id: "e-1" })
    registry.executorOf.mockReturnValue(executor)
    const effects = mock<GraphNodeEffectsService>()
    effects.once.mockImplementation((_workspace, _effect, _call, act) => act())
    const ai = mock<NodeModelDoor>()
    ai.nodeText.mockResolvedValue("hi")
    ai.nodeJson.mockResolvedValue({ n: 2 })
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.mint.mockReturnValue("token-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
        ],
    }).compile()
    return moduleRef.get(GraphNodeHostService)
}

/** The host where no run token service is bound. */
const buildWithoutTokens = async (port: NodeDataPort) => {
    const registry = mock<GraphNodeRegistryService>()
    registry.installed.mockReturnValue(INSTALL)
    registry.subjectResolvers.mockReturnValue([])
    registry.nodeOf.mockReturnValue(probeNode)
    registry.portOf.mockReturnValue(port)
    const executor = mock<NodeEffectExecutor>({ effect: "core.ping" })
    executor.execute.mockResolvedValue({ kind: "record", id: "e-1" })
    registry.executorOf.mockReturnValue(executor)
    const effects = mock<GraphNodeEffectsService>()
    effects.once.mockImplementation((_workspace, _effect, _call, act) => act())
    const ai = mock<NodeModelDoor>()
    ai.nodeText.mockResolvedValue("hi")
    ai.nodeJson.mockResolvedValue({ n: 2 })
    const tools = mock<NodeToolDoor>()
    tools.call.mockResolvedValue({ seen: true })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: tools },
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService), tools }
}

/** A data port that reads no rows and has no write. */
const readingPort = (): NodeDataPort => ({ kind: "record", read: () => Promise.resolve([]) })

/** The key of the probe's one effect call: the step, then the digest of the effect and its arguments. */
const PING_KEY = `run-1:node:${callDigestOf("core.ping", { n: 1 })}`

/** The model of the probe node: blocks-core declares nothing for it, so the default (a node the table does not know weighs heavy). */
const PROBE_MODEL = { model: "claude-sonnet-5-5", weight: "heavy", source: "default" }
/** The engine core's model as blocks-core declares it, in either position of its ALL_NODES_ON_CLAUDE switch. */
const CORE_MODEL = { model: ENGINE_CORE_MODEL.model, weight: "heavy", source: "declared" }

describe("GraphNodeHostService", () => {
    it("runs a node through the registered port, the ledgered executor, the model and the tool door", async () => {
        const port = mock<NodeDataPort>({ kind: "record" })
        port.read.mockResolvedValue([{ id: "1" }])
        const { host, executor, effects, ai, tools } = await build(port)

        await expect(host.run(INPUT)).resolves.toEqual({
            output: { rows: 1, ref: "e-1", text: "hi", n: 2, seen: true, at: 1 },
            effects: [{ id: "core.ping", subject: { kind: "record", id: "e-1" } }],
        })
        expect(port.read).toHaveBeenCalledWith(INPUT.turn, { fields: ["id"] }, "turn")
        expect(effects.once.mock.calls.map((call) => [call[0], call[1], call[2], call[4]])).toEqual([
            ["ws-1", "core.ping", { key: PING_KEY, dedupeKey: null }, { args: { n: 1 } }],
        ])
        expect(executor.execute).toHaveBeenCalledWith(INPUT.turn, { n: 1 }, { key: PING_KEY, dedupeKey: null })
        expect(ai.nodeText).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi", model: PROBE_MODEL },
            { purpose: "core.probe:say", instructions: "", input: null },
        )
        expect(tools.call).toHaveBeenCalledWith({
            token: "token-1",
            tool: "core.look",
            args: {},
            key: `run-1:node:tool:${callDigestOf("core.look", {})}`,
            approval: null,
        })
    })

    it("books every model call of the node to its step and the turn's agent (U1: model and credits per node)", async () => {
        const { host, ai } = await build(readingPort())
        const seen: Array<unknown> = []
        ai.nodeText.mockImplementation(() => {
            seen.push(workInScope())
            return Promise.resolve("hi")
        })

        await host.run(INPUT)

        expect(seen).toEqual([
            {
                kind: "node",
                ref: null,
                stepKey: INPUT.key.slice(INPUT.key.indexOf(":") + 1),
                agentId: INPUT.turn.agentId,
            },
        ])
        expect(workInScope()).toBeNull()
    })

    it("stops the node at a call that waits for a person, even when the node catches its tool's failures", async () => {
        const { host, registry, executor, tools } = await build(readingPort())
        const ask = askOf()
        tools.call.mockRejectedValue(ask)
        registry.nodeOf.mockReturnValue(swallowNode)

        await expect(host.run({ ...INPUT, nodeId: "core.swallow", input: {} })).rejects.toBe(ask)
        expect(executor.execute).not.toHaveBeenCalled()
    })

    it("lets a node handle any other failure of its tool", async () => {
        const { host, registry, tools } = await build(readingPort())
        tools.call.mockRejectedValue(new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected }))
        registry.nodeOf.mockReturnValue(swallowNode)

        await expect(host.run({ ...INPUT, nodeId: "core.swallow", input: {} })).resolves.toMatchObject({
            output: { fell: true },
        })
    })

    it("answers the ask, not the node's own error, when a node throws after its call was refused for a person", async () => {
        const { host, tools } = await build(readingPort())
        const ask = askOf()
        tools.call.mockRejectedValue(ask)

        await expect(host.run(INPUT)).rejects.toBe(ask)
    })

    it("hands the tool door the run token and the approval the step carries", async () => {
        const { host, tokens, tools } = await build(readingPort())
        const approval = { by: "member-1", fingerprint: "f-1" }

        await host.run({ ...INPUT, approval })

        expect(tokens.mint).toHaveBeenCalledWith(INPUT.turn)
        expect(tools.call.mock.calls[0]?.[0]).toMatchObject({ token: "token-1", approval })
    })
})

describe("GraphNodeHostService effect rights", () => {
    it("asks the door for the right of each effect with the run token, and runs the effect when the door has no objection", async () => {
        const { host, tools, executor } = await build(readingPort())
        tools.effectRight = jest.fn().mockResolvedValue(null)

        await host.run(INPUT)

        expect(tools.effectRight).toHaveBeenCalledWith({
            token: "token-1",
            effect: "core.ping",
            payload: { n: 1 },
            approval: null,
        })
        expect(executor.execute).toHaveBeenCalled()
    })

    it("answers the door's refusal as the effect's ordinary refusal fact, and neither runs nor ledgers the effect", async () => {
        const { host, tools, executor, effects } = await build(readingPort())
        const refusal = { kind: "refused", id: "not_attached", facts: { tool: "core.ping" } }
        tools.effectRight = jest.fn().mockResolvedValue(refusal)

        await expect(host.run(INPUT)).resolves.toMatchObject({ output: { ref: "not_attached" }, effects: [] })
        expect(executor.execute).not.toHaveBeenCalled()
        expect(effects.once).not.toHaveBeenCalled()
    })

    it("stops the node at an effect whose right waits for a person, like a tool that waits", async () => {
        const { host, tools, executor } = await build(readingPort())
        const ask = askOf()
        tools.effectRight = jest.fn().mockRejectedValue(ask)

        await expect(host.run(INPUT)).rejects.toBe(ask)
        expect(executor.execute).not.toHaveBeenCalled()
        expect(tools.call).not.toHaveBeenCalled()
    })
})

describe("GraphNodeHostService replay hook", () => {
    it("runs the node on the ports the engine's wrapper answers, handing it the host's own ports", async () => {
        const { host, executor, ai } = await build(readingPort())
        const seen: Array<string> = []
        const replay = jest.fn((ports: NodeHostPorts): NodeHostPorts => ({
            ...ports,
            execute: (effect, payload, call) => {
                seen.push(`execute:${effect.id}`)
                return ports.execute(effect, payload, call)
            },
            model: {
                ...ports.model,
                text: () => {
                    seen.push("model.text")
                    return Promise.resolve("replayed")
                },
            },
        }))

        await expect(host.run({ ...INPUT, replay })).resolves.toMatchObject({
            output: { text: "replayed", ref: "e-1" },
        })

        expect(replay).toHaveBeenCalledTimes(1)
        expect(seen).toEqual(expect.arrayContaining(["execute:core.ping", "model.text"]))
        expect(executor.execute).toHaveBeenCalledTimes(1)
        expect(ai.nodeText).not.toHaveBeenCalled()
    })

    it("a wrapper that answers a call itself keeps it from the host: no right is asked, nothing is ledgered, no executor runs", async () => {
        const { host, executor, effects, tools } = await build(readingPort())
        tools.effectRight = jest.fn().mockResolvedValue(null)
        const replay = (ports: NodeHostPorts): NodeHostPorts => ({
            ...ports,
            execute: () => Promise.resolve({ kind: "record", id: "kept" }),
        })

        await expect(host.run({ ...INPUT, replay })).resolves.toMatchObject({ output: { ref: "kept" } })

        expect(tools.effectRight).not.toHaveBeenCalled()
        expect(effects.once).not.toHaveBeenCalled()
        expect(executor.execute).not.toHaveBeenCalled()
    })

    it("runs on the host's ports as they are when no wrapper is given", async () => {
        const { host, executor } = await build(readingPort())

        await expect(host.run(INPUT)).resolves.toMatchObject({ output: { ref: "e-1" } })
        expect(executor.execute).toHaveBeenCalledTimes(1)
    })
})

describe("GraphNodeHostService repeat guard", () => {
    it("asks the door, just before the executor acts, with the step's key, the turn and when this attempt began", async () => {
        const { host, tools, executor } = await build(readingPort())
        tools.repeatGuard = jest.fn().mockResolvedValue(null)

        await host.run(INPUT)

        expect(tools.repeatGuard).toHaveBeenCalledWith({
            effect: "core.ping",
            payload: { n: 1 },
            turn: INPUT.turn,
            step: "run-1:node",
            startedAt: "2026-11-04T10:00:00.000Z",
        })
        expect(executor.execute).toHaveBeenCalledTimes(1)
    })

    it("answers the door's refusal as the effect's fact and does not act; the ledger keeps no refusal", async () => {
        const { host, tools, executor, effects } = await build(readingPort())
        const refusal = { kind: "refused", id: "already_told_for_this_stop", facts: { conversationId: "c-1" } }
        tools.repeatGuard = jest.fn().mockResolvedValue(refusal)

        await expect(host.run(INPUT)).resolves.toMatchObject({
            output: { ref: "already_told_for_this_stop" },
            effects: [],
        })

        expect(effects.once).toHaveBeenCalledTimes(1)
        expect(executor.execute).not.toHaveBeenCalled()
    })

    it("is not asked for a call the ledger already holds: the step's own earlier call is replayed as it was", async () => {
        const { host, tools, executor, effects } = await build(readingPort())
        tools.repeatGuard = jest.fn().mockResolvedValue({ kind: "refused", id: "already_told_for_this_stop" })
        effects.once.mockResolvedValue({ kind: "record", id: "kept-by-ledger" })

        await expect(host.run(INPUT)).resolves.toMatchObject({ output: { ref: "kept-by-ledger" } })

        expect(tools.repeatGuard).not.toHaveBeenCalled()
        expect(executor.execute).not.toHaveBeenCalled()
    })
})

/** The host with the prebuilt loop bound and the `AGENT_LOOP` flag naming `nodes`. */
const buildWithLoop = async (nodes: ReadonlyArray<string>, bound = true) => {
    const registry = mock<GraphNodeRegistryService>()
    registry.installed.mockReturnValue(INSTALL)
    registry.subjectResolvers.mockReturnValue([])
    registry.nodeOf.mockReturnValue(probeNode)
    registry.portOf.mockReturnValue(readingPort())
    const executor = mock<NodeEffectExecutor>({ effect: "core.ping" })
    executor.execute.mockResolvedValue({ kind: "record", id: "e-1" })
    registry.executorOf.mockReturnValue(executor)
    const effects = mock<GraphNodeEffectsService>()
    effects.once.mockImplementation((_workspace, _effect, _call, act) => act())
    const ai = mock<Required<NodeModelDoor>>()
    ai.nodeText.mockResolvedValue("hi")
    ai.nodeJson.mockResolvedValue({ n: 2 })
    ai.nodeAgentTurns.mockReturnValue({ toolChoice: "auto" })
    ai.nodeImages.mockResolvedValue(["data:image/png;base64,AAAA"])
    const loops = mock<NodeAgentLoops>()
    loops.run.mockResolvedValue({ turns: 1 })
    const tools = mock<NodeToolDoor>()
    tools.call.mockResolvedValue({ seen: true })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:00:00.000Z") },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: tools },
            { provide: GRAPH_NODES_OPTIONS, useValue: { agentLoop: { nodes } } },
            ...(bound ? [{ provide: GRAPH_NODE_AGENT_LOOPS, useValue: loops }] : []),
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService), ai, loops, registry }
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

    it("refuses to start when the flag names a node that is not installed, or names nodes where no loop is bound", async () => {
        const unknown = await buildWithLoop(["core.nowhere"])
        expect(() => unknown.host.onModuleInit()).toThrow(
            expect.objectContaining({
                code: GraphNodesErrorCode.AgentLoopFlagInvalid,
                params: { name: "core.nowhere" },
            }),
        )

        const unbound = await buildWithLoop(["core.probe"], false)
        expect(() => unbound.host.onModuleInit()).toThrow(
            expect.objectContaining({ code: GraphNodesErrorCode.AgentLoopFlagInvalid }),
        )

        const fine = await buildWithLoop(["core.probe"])
        expect(() => fine.host.onModuleInit()).not.toThrow()
        const off = await buildWithLoop([], false)
        expect(() => off.host.onModuleInit()).not.toThrow()
    })
})

describe("GraphNodeHostService ports", () => {
    it("writes through a port that writes, and refuses a kind whose port does not", async () => {
        const write = jest.fn().mockResolvedValue({ kind: "record", id: "w-1" })
        const writing = await build({ kind: "record", read: () => Promise.resolve([]), write })
        await expect(writing.host.run({ ...INPUT, input: { write: true } })).resolves.toMatchObject({
            output: { ref: "w-1" },
        })
        expect(write).toHaveBeenCalledWith(INPUT.turn, { id: "r" })

        const readOnly = await build(readingPort())
        await expect(readOnly.host.run({ ...INPUT, input: { write: true } })).rejects.toMatchObject({
            code: GraphNodesErrorCode.PortMissing,
        })
    })

    it.each([
        ["returns without touching a port again", "none"],
        ["writes a record", "write"],
    ] as const)("answers the ask when a node catches the refusal of its tool and then %s", async (_name, after) => {
        const write = jest.fn().mockResolvedValue({ kind: "record", id: "w-1" })
        const { host, registry, tools } = await build({ kind: "record", read: () => Promise.resolve([]), write })
        const ask = askOf()
        tools.call.mockRejectedValue(ask)
        registry.nodeOf.mockReturnValue(swallowNode)

        await expect(host.run({ ...INPUT, nodeId: "core.swallow", input: { after } })).rejects.toBe(ask)
        expect(write).not.toHaveBeenCalled()
    })

    it("calls the tool door with an empty run token when no run token service is bound", async () => {
        const { host, tools } = await buildWithoutTokens(readingPort())

        await host.run(INPUT)

        expect(tools.call.mock.calls[0]?.[0]).toMatchObject({ token: "", tool: "core.look" })
    })

    it("refuses a tool call while no NIVO MCP door is bound", async () => {
        const host = await buildWithoutDoor(readingPort())
        await expect(host.run(INPUT)).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolDoorMissing })
    })
})

describe("GraphNodeHostService subjects and undo", () => {
    it("gives a turn with no subject the first subject a resolver knows, and keeps a subject the trigger named", async () => {
        const none = mock<NodeSubjectResolver>()
        none.subjectOf.mockResolvedValue(null)
        const lead = mock<NodeSubjectResolver>()
        lead.subjectOf.mockResolvedValue({ kind: "sales-lead", id: "l-1" })
        const port = mock<NodeDataPort>({ kind: "record" })
        port.read.mockResolvedValue([])
        const { host } = await build(port, [none, lead])

        await host.run(INPUT)
        expect(port.read.mock.calls[0]?.[0].subject).toEqual({ kind: "sales-lead", id: "l-1" })

        const named = { ...INPUT.turn, subject: { kind: "order", id: "o-1" } }
        await host.run({ ...INPUT, turn: named })
        expect(port.read.mock.calls[1]?.[0].subject).toEqual({ kind: "order", id: "o-1" })
        expect(none.subjectOf).toHaveBeenCalledTimes(1)
    })

    it("runs a turn on no subject when no resolver knows one", async () => {
        const none = mock<NodeSubjectResolver>()
        none.subjectOf.mockResolvedValue(null)
        const port = mock<NodeDataPort>({ kind: "record" })
        port.read.mockResolvedValue([])
        const { host } = await build(port, [none])

        await host.run(INPUT)

        expect(port.read.mock.calls[0]?.[0].subject).toBeNull()
    })

    it("undoes each effect with a compensation, last first, keyed by its place, and skips one with none", async () => {
        const { host, executor, effects } = await build(readingPort())
        const done = [
            { id: "core.ping", subject: { kind: "record", id: "a" } },
            { id: "core.other", subject: { kind: "record", id: "b" } },
            { id: "core.lost", subject: { kind: "record", id: "c" } },
            { id: "core.ping", subject: { kind: "record", id: "d" } },
        ]

        await host.undo({ turn: INPUT.turn, done, key: "run-1:node" })

        expect(effects.once.mock.calls.map((call) => [call[1], call[2]])).toEqual([
            ["core.unping", { key: "run-1:node:undo:3", dedupeKey: null }],
            ["core.unping", { key: "run-1:node:undo:0", dedupeKey: null }],
        ])
        expect(executor.execute.mock.calls.map((call) => call[1])).toEqual([{ id: "d" }, { id: "a" }])
    })

    it("skips the undo of an effect whose compensation payload is not a record, running nothing", async () => {
        const { host, executor, effects } = await build(readingPort())
        const done = [{ id: "core.flat", subject: { kind: "record", id: "a" } }]

        await host.undo({ turn: INPUT.turn, done, key: "run-1:node" })

        expect(effects.once).not.toHaveBeenCalled()
        expect(executor.execute).not.toHaveBeenCalled()
    })
})

describe("GraphNodeHostService.core", () => {
    const ASK = { purpose: "ai-core", instructions: "Decide once.", input: { step: "keep" } }

    it("asks the engine's own decision under the policy of the turn's agent: its guidance and values go before the instructions", async () => {
        const { host, ai } = await build(readingPort())
        ai.nodeJson.mockResolvedValue({ n: 7 })
        const turn = {
            ...INPUT.turn,
            guidance: "CHÍNH SÁCH: hỏi chủ tiệm.",
            policy: { approvalThresholdVnd: 3_000_000 },
        }

        await expect(host.core(turn, ASK, z.object({ n: z.number() }))).resolves.toEqual({ n: 7 })

        const [scope, asked] = ai.nodeJson.mock.calls[0] ?? []
        expect(scope).toEqual({ workspaceId: "ws-1", locale: "vi", model: CORE_MODEL })
        expect(asked?.instructions.startsWith("CHÍNH SÁCH: hỏi chủ tiệm.\n\n")).toBe(true)
        expect(asked?.instructions).toContain('{"approvalThresholdVnd":3000000}')
        expect(asked?.instructions.endsWith("\n\nDecide once.")).toBe(true)
    })

    it("books the engine's own decision as engine-core work of the turn's agent", async () => {
        const { host, ai } = await build(readingPort())
        const seen: Array<unknown> = []
        ai.nodeJson.mockImplementation(() => {
            seen.push(workInScope())
            return Promise.resolve({ n: 1 })
        })

        await host.core(INPUT.turn, ASK, z.object({ n: z.number() }))

        expect(seen).toEqual([{ kind: "engine_core", ref: null, stepKey: null, agentId: INPUT.turn.agentId }])
    })

    it("asks with the instructions as they are for a turn that carries no policy", async () => {
        const { host, ai } = await build(readingPort())
        ai.nodeJson.mockResolvedValue({ n: 7 })

        await host.core(INPUT.turn, ASK, z.object({ n: z.number() }))

        expect(ai.nodeJson).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi", model: CORE_MODEL },
            ASK,
            expect.anything(),
        )
    })
})

describe("GraphNodeHostService the model of a node's calls", () => {
    it("hands the model door the model the graph's node names, with blocks-core's weight for its step", async () => {
        const { host, ai } = await build(readingPort())

        await host.run({ ...INPUT, model: "deepseek/deepseek-v4.1-flash" })

        expect(ai.nodeText.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            locale: "vi",
            model: { model: "deepseek/deepseek-v4.1-flash", weight: "heavy", source: "node" },
        })
    })
})
