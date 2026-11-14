import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { swallowNode } from "@nivo-lite/agent-sdk/testing"
import { callDigestOf } from "@nivo-lite/agent-sdk/node"
import { CLOCK } from "@modules/platform/clock"
import { workInScope } from "@modules/platform/logging"
import {
    CORE_MODEL,
    PROBE_MODEL,
    PROBE_PING_KEY as PING_KEY,
    PROBE_RUN as INPUT,
    armGraphNodeDoubles,
    probeAskOf as askOf,
    readingPort,
} from "@tests/fixtures/builders/graph-nodes.builder"
import { ASK_OWNER_GUIDANCE_VI } from "@tests/fixtures/i18n/graph-nodes-spec.messages"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import { GraphNodeHostService } from "./graph-node-host.service"
import { PROBE_COUNT } from "./graph-node-probe.schema"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GraphNodeRunTokensService } from "./graph-node-run-tokens.service"
import { GRAPH_NODE_MODEL, GRAPH_NODE_TOOL_DOOR } from "./graph-nodes.decorators"
import type { NodeDataPort, NodeModelDoor, NodeSubjectResolver, NodeToolDoor } from "./graph-nodes.contracts"

const NOW = "2026-11-04T10:00:00.000Z"

/** The host with every port bound; `port` is what the registry answers for the `record` kind. */
const build = async (port: NodeDataPort, resolvers: ReadonlyArray<NodeSubjectResolver> = []) => {
    const registry = mock<GraphNodeRegistryService>()
    const effects = mock<GraphNodeEffectsService>()
    const ai = mock<Required<NodeModelDoor>>()
    const tokens = mock<GraphNodeRunTokensService>()
    const tools = mock<NodeToolDoor>({ run: undefined })
    const executor = armGraphNodeDoubles({ registry, effects, ai, tokens, tools }, port, resolvers)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
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
    const effects = mock<GraphNodeEffectsService>()
    const ai = mock<Required<NodeModelDoor>>()
    const tokens = mock<GraphNodeRunTokensService>()
    const tools = mock<NodeToolDoor>({ run: undefined })
    armGraphNodeDoubles({ registry, effects, ai, tokens, tools }, port)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
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
    const effects = mock<GraphNodeEffectsService>()
    const ai = mock<Required<NodeModelDoor>>()
    const tokens = mock<GraphNodeRunTokensService>()
    const tools = mock<NodeToolDoor>({ run: undefined })
    armGraphNodeDoubles({ registry, effects, ai, tokens, tools }, port)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: GRAPH_NODE_MODEL, useValue: ai },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: tools },
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService), tools }
}

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
            key: `run-1:node:${callDigestOf("core.look", {})}`,
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

describe("GraphNodeHostService subjects", () => {
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
})

describe("GraphNodeHostService.core", () => {
    const ASK = { purpose: "ai-core", instructions: "Decide once.", input: { step: "keep" } }

    it("asks the engine's own decision under the guidance of the turn's agent: it goes before the instructions", async () => {
        const { host, ai } = await build(readingPort())
        ai.nodeJson.mockResolvedValue({ n: 7 })
        const turn = {
            ...INPUT.turn,
            guidance: ASK_OWNER_GUIDANCE_VI,
        }

        await expect(host.core(turn, ASK, PROBE_COUNT)).resolves.toEqual({ n: 7 })

        const [scope, asked] = ai.nodeJson.mock.calls[0] ?? []
        expect(scope).toEqual({ workspaceId: "ws-1", locale: "vi", model: CORE_MODEL })
        expect(asked?.instructions.startsWith(`${ASK_OWNER_GUIDANCE_VI}\n\n`)).toBe(true)
        expect(asked?.instructions.endsWith("\n\nDecide once.")).toBe(true)
    })

    it("books the engine's own decision as engine-core work of the turn's agent", async () => {
        const { host, ai } = await build(readingPort())
        const seen: Array<unknown> = []
        ai.nodeJson.mockImplementation(() => {
            seen.push(workInScope())
            return Promise.resolve({ n: 1 })
        })

        await host.core(INPUT.turn, ASK, PROBE_COUNT)

        expect(seen).toEqual([{ kind: "engine_core", ref: null, stepKey: null, agentId: INPUT.turn.agentId }])
    })

    it("ENG1 (step_key NULL on dev): books the engine's own decision to the run step it decides on", async () => {
        const { host, ai } = await build(readingPort())
        const seen: Array<unknown> = []
        ai.nodeJson.mockImplementation(() => {
            seen.push(workInScope())
            return Promise.resolve({ n: 1 })
        })

        await host.core(INPUT.turn, ASK, PROBE_COUNT, "answer")
        await host.core(INPUT.turn, ASK, PROBE_COUNT, "notify[2]")

        expect(seen).toEqual([
            { kind: "engine_core", ref: null, stepKey: "answer", agentId: INPUT.turn.agentId },
            { kind: "engine_core", ref: null, stepKey: "notify[2]", agentId: INPUT.turn.agentId },
        ])
    })

    it("asks with the instructions as they are for a turn that carries no guidance", async () => {
        const { host, ai } = await build(readingPort())
        ai.nodeJson.mockResolvedValue({ n: 7 })

        await host.core(INPUT.turn, ASK, PROBE_COUNT)

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

describe("GraphNodeHostService the workflow step of a run", () => {
    const STEP = { nodeKey: "send-qr", versionId: "v-3", workflowId: "wf-1" }

    it("signs the step into every run token of the node and names it to the effect's executor, never to the node", async () => {
        const port = mock<NodeDataPort>({ kind: "record" })
        port.read.mockResolvedValue([{ id: "1" }])
        const { host, tokens, executor, tools } = await build(port)
        tools.effectRight = jest.fn().mockResolvedValue(null)

        const ran = await host.run({ ...INPUT, step: STEP })

        // Every token of the run (the effect's right, the tool call) carries the step.
        expect(tokens.mint.mock.calls.length).toBeGreaterThan(0)
        expect(tokens.mint.mock.calls.every((call) => call[0] === INPUT.turn && call[1] === STEP)).toBe(true)
        // The executor's turn names the step; the data port (and so the node) reads the turn as it was.
        expect(executor.execute.mock.calls[0]?.[0]).toEqual({ ...INPUT.turn, step: STEP })
        expect(port.read).toHaveBeenCalledWith(INPUT.turn, { fields: ["id"] }, "turn")
        // The same output and effects as a run that names no step.
        expect(ran).toEqual({
            output: { rows: 1, ref: "e-1", text: "hi", n: 2, seen: true, at: 1 },
            effects: [{ id: "core.ping", subject: { kind: "record", id: "e-1" } }],
        })
    })

    it("mints as before and hands the executor the turn itself when the engine names no step", async () => {
        const port = mock<NodeDataPort>({ kind: "record" })
        port.read.mockResolvedValue([{ id: "1" }])
        const { host, tokens, executor } = await build(port)

        await host.run(INPUT)

        expect(tokens.mint.mock.calls.every((call) => call.length === 1)).toBe(true)
        expect(executor.execute.mock.calls[0]?.[0]).toBe(INPUT.turn)
    })
})
