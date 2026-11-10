import { Test } from "@nestjs/testing"
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
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import { GraphNodeHostService } from "./graph-node-host.service"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GraphNodeRunTokensService } from "./graph-node-run-tokens.service"
import { GRAPH_NODE_MODEL, GRAPH_NODE_TOOL_DOOR } from "./graph-nodes.decorators"
import type {
    NodeDataPort,
    NodeEffectExecutor,
    NodeModelDoor,
    NodeRunInput,
    NodeSubjectResolver,
    NodeToolDoor,
} from "./graph-nodes.contracts"

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
        expect(effects.once.mock.calls.map((call) => [call[0], call[1], call[2]])).toEqual([
            ["ws-1", "core.ping", { key: PING_KEY, dedupeKey: null }],
        ])
        expect(executor.execute).toHaveBeenCalledWith(INPUT.turn, { n: 1 }, { key: PING_KEY, dedupeKey: null })
        expect(ai.nodeText).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
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
        const turn = { ...INPUT.turn, guidance: "CHÍNH SÁCH: hỏi chủ tiệm.", policy: { approvalThresholdVnd: 3_000_000 } }

        await expect(host.core(turn, ASK, z.object({ n: z.number() }))).resolves.toEqual({ n: 7 })

        const [scope, asked] = ai.nodeJson.mock.calls[0] ?? []
        expect(scope).toEqual({ workspaceId: "ws-1", locale: "vi" })
        expect(asked?.instructions.startsWith("CHÍNH SÁCH: hỏi chủ tiệm.\n\n")).toBe(true)
        expect(asked?.instructions).toContain('{"approvalThresholdVnd":3000000}')
        expect(asked?.instructions.endsWith("\n\nDecide once.")).toBe(true)
    })

    it("asks with the instructions as they are for a turn that carries no policy", async () => {
        const { host, ai } = await build(readingPort())
        ai.nodeJson.mockResolvedValue({ n: 7 })

        await host.core(INPUT.turn, ASK, z.object({ n: z.number() }))

        expect(ai.nodeJson).toHaveBeenCalledWith({ workspaceId: "ws-1", locale: "vi" }, ASK, expect.anything())
    })
})
