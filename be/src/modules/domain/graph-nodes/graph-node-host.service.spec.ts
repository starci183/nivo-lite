import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import {
    look,
    lost,
    ping,
    probe,
    READ,
    swallow,
    unping,
    WRITE,
} from "@tests/fixtures/builders/graph-node-probe.builder"
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
    grant: { rights: [READ, WRITE], tools: ["core.look"] },
    key: "run-1:node",
}

const READING: NodeDataPort = { kind: "record", read: () => Promise.resolve([]) }

const build = async (
    port: NodeDataPort = READING,
    resolvers: ReadonlyArray<NodeSubjectResolver> = [],
    doorBound: boolean = true,
) => {
    const registry = mock<GraphNodeRegistryService>()
    registry.installed.mockReturnValue(
        nodeIndexOf({ nodes: [probe], effects: [ping, unping, lost], tools: [look], dataKinds: [] }),
    )
    registry.subjectResolvers.mockReturnValue(resolvers)
    registry.nodeOf.mockReturnValue(probe)
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
    const clock = new FakeClock("2026-11-04T10:00:00.000Z")
    const moduleRef = doorBound
        ? await Test.createTestingModule({
              providers: [
                  GraphNodeHostService,
                  { provide: GraphNodeRunTokensService, useValue: tokens },
                  { provide: CLOCK, useValue: clock },
                  { provide: GraphNodeRegistryService, useValue: registry },
                  { provide: GraphNodeEffectsService, useValue: effects },
                  { provide: GRAPH_NODE_MODEL, useValue: ai },
                  { provide: GRAPH_NODE_TOOL_DOOR, useValue: tools },
              ],
          }).compile()
        : await Test.createTestingModule({
              providers: [
                  GraphNodeHostService,
                  { provide: GraphNodeRunTokensService, useValue: tokens },
                  { provide: CLOCK, useValue: clock },
                  { provide: GraphNodeRegistryService, useValue: registry },
                  { provide: GraphNodeEffectsService, useValue: effects },
                  { provide: GRAPH_NODE_MODEL, useValue: ai },
              ],
          }).compile()
    return { host: moduleRef.get(GraphNodeHostService), tools, registry, executor, effects, ai, tokens }
}

/** A port that answers no rows and records its reads. */
const emptyPort = (): NodeDataPort => {
    const port = mock<NodeDataPort>({ kind: "record" })
    port.read.mockResolvedValue([])
    return port
}

/** Makes the swallowing node the one the registry serves. */
const serveSwallow = (registry: MockOf<GraphNodeRegistryService>): void => {
    registry.nodeOf.mockReturnValue(swallow)
    registry.installed.mockReturnValue(
        nodeIndexOf({ nodes: [probe, swallow], effects: [ping, unping, lost], tools: [look], dataKinds: [] }),
    )
}

describe("GraphNodeHostService", () => {
    it("runs a node through the registered port, the ledgered executor, the model and the tool door", async () => {
        const port = mock<NodeDataPort>({ kind: "record" })
        port.read.mockResolvedValue([{ id: "1" }])
        const { host, tools, executor, effects, ai } = await build(port)

        await expect(host.run(INPUT)).resolves.toEqual({
            output: { rows: 1, ref: "e-1", text: "hi", n: 2, seen: true, at: 1 },
            effects: [{ id: "core.ping", subject: { kind: "record", id: "e-1" } }],
        })
        expect(port.read).toHaveBeenCalledWith(INPUT.turn, { fields: ["id"] }, "turn")
        expect(effects.once).toHaveBeenCalledWith(
            "ws-1",
            "core.ping",
            { key: "run-1:node:0", dedupeKey: null },
            expect.any(Function),
        )
        expect(executor.execute).toHaveBeenCalledWith(INPUT.turn, { n: 1 }, { key: "run-1:node:0", dedupeKey: null })
        expect(ai.nodeText).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
            { purpose: "core.probe:say", instructions: "", input: null },
        )
        expect(tools.call).toHaveBeenCalledWith({
            token: "token-1",
            tool: "core.look",
            args: {},
            key: "run-1:node:tool:0",
            approval: null,
        })
    })

    it("stops the node at a call that waits for a person, even when the node catches its tool's failures", async () => {
        const { host, tools, registry, executor } = await build()
        const ask = askOf()
        tools.call.mockRejectedValue(ask)
        serveSwallow(registry)

        await expect(host.run({ ...INPUT, nodeId: "core.swallow", input: {} })).rejects.toBe(ask)
        expect(executor.execute).not.toHaveBeenCalled()
    })

    it("lets a node handle any other failure of its tool", async () => {
        const { host, tools, registry } = await build()
        tools.call.mockRejectedValue(new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected }))
        serveSwallow(registry)

        await expect(host.run({ ...INPUT, nodeId: "core.swallow", input: {} })).resolves.toMatchObject({
            output: { fell: true },
        })
    })
})

describe("GraphNodeHostService tool door and ports", () => {
    it("answers the ask, not the node's own error, when a node throws after its call was refused for a person", async () => {
        const { host, tools } = await build()
        const ask = askOf()
        tools.call.mockRejectedValue(ask)

        await expect(host.run(INPUT)).rejects.toBe(ask)
    })

    it("hands the tool door the run token and the approval the step carries", async () => {
        const { host, tools, tokens } = await build()
        const approval = { by: "member-1", fingerprint: "f-1" }

        await host.run({ ...INPUT, approval })

        expect(tokens.mint).toHaveBeenCalledWith(INPUT.turn)
        expect(tools.call).toHaveBeenCalledWith(expect.objectContaining({ token: "token-1", approval }))
    })

    it("writes through a port that writes, and refuses a kind whose port does not", async () => {
        const port = mock<NodeDataPort>({ kind: "record" })
        port.read.mockResolvedValue([])
        port.write = jest.fn().mockResolvedValue({ kind: "record", id: "w-1" })
        const writing = await build(port)
        await expect(writing.host.run({ ...INPUT, input: { write: true } })).resolves.toMatchObject({
            output: { ref: "w-1" },
        })
        expect(port.write).toHaveBeenCalledWith(INPUT.turn, { id: "r" })

        const readOnly = await build(READING)
        await expect(readOnly.host.run({ ...INPUT, input: { write: true } })).rejects.toMatchObject({
            code: GraphNodesErrorCode.PortMissing,
        })
    })

    it("refuses a tool call while no NIVO MCP door is bound", async () => {
        const { host } = await build(READING, [], false)
        await expect(host.run(INPUT)).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolDoorMissing })
    })
})

describe("GraphNodeHostService subjects and undo", () => {
    it("gives a turn with no subject the first subject a resolver knows, and keeps a subject the trigger named", async () => {
        const none = mock<NodeSubjectResolver>()
        none.subjectOf.mockResolvedValue(null)
        const lead = mock<NodeSubjectResolver>()
        lead.subjectOf.mockResolvedValue({ kind: "sales-lead", id: "l-1" })
        const port = emptyPort()
        const { host } = await build(port, [none, lead])

        await host.run(INPUT)
        expect(port.read).toHaveBeenNthCalledWith(
            1,
            { ...INPUT.turn, subject: { kind: "sales-lead", id: "l-1" } },
            { fields: ["id"] },
            "turn",
        )

        const named = { ...INPUT.turn, subject: { kind: "order", id: "o-1" } }
        await host.run({ ...INPUT, turn: named })
        expect(port.read).toHaveBeenNthCalledWith(2, named, { fields: ["id"] }, "turn")
        expect(none.subjectOf).toHaveBeenCalledTimes(1)
    })

    it("runs a turn on no subject when no resolver knows one", async () => {
        const port = emptyPort()
        const { host } = await build(port, [{ subjectOf: () => Promise.resolve(null) }])
        await host.run(INPUT)
        expect(port.read).toHaveBeenCalledWith(INPUT.turn, { fields: ["id"] }, "turn")
    })

    it("undoes each effect with a compensation, last first, keyed by its place, and skips one with none", async () => {
        const { host, executor, effects } = await build()
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
})
