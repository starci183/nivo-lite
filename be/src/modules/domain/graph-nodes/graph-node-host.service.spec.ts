import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { z } from "zod"
import { defineEffect, defineNode, defineTool, nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { AiTasksService } from "@modules/domain/ai-tasks"
import { GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeEffectsService } from "./graph-node-effects.service"
import { GraphNodeHostService } from "./graph-node-host.service"
import { GraphNodeRegistryService } from "./graph-node-registry.service"
import { GRAPH_NODE_TOOL_DOOR } from "./graph-nodes.decorators"
import type {
    NodeDataPort,
    NodeEffectExecutor,
    NodeRunInput,
    NodeSubjectResolver,
    NodeToolDoor,
} from "./graph-nodes.contracts"

const READ = { kind: "record", access: "read", scope: "turn", fields: ["id"] } as const
const WRITE = { kind: "record", access: "write", scope: "turn", fields: ["id"] } as const

const unping = defineEffect({ id: "core.unping", title: { key: "u" }, payload: z.object({ id: z.string() }), rights: [] })
const ping = defineEffect({
    id: "core.ping",
    title: { key: "p" },
    payload: z.object({ n: z.number() }),
    rights: [],
    compensation: "core.unping",
})
const lost = defineEffect({ ...ping, id: "core.lost", compensation: "core.gone" })
const look = defineTool({
    id: "core.look",
    title: { key: "l" },
    args: z.object({}),
    result: z.object({ seen: z.boolean() }),
    mutates: false,
    rights: [],
})

/** A node that touches every port once and answers what came back. */
const probe = defineNode({
    id: "core.probe",
    role: "execute",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ write: z.boolean() }),
    output: z.object({ rows: z.number(), ref: z.string(), text: z.string(), n: z.number(), seen: z.boolean(), at: z.number() }),
    rights: [READ, WRITE],
    effects: ["core.ping"],
    tools: ["core.look"],
    run: async (input, context) => {
        const rows = await context.data.read("record", { fields: ["id"] })
        const ref = input.write ? await context.data.write("record", { id: "r" }) : await context.effect("core.ping", { n: 1 })
        const text = await context.model.text({ purpose: "say", instructions: "", input: null })
        const json = await context.model.json(z.object({ n: z.number() }), { purpose: "count", instructions: "", input: null })
        const tool = await context.tools.call<{ seen: boolean }>("core.look", {})
        return { rows: rows.length, ref: ref.id, text, n: json.n, seen: tool.seen, at: context.now().getTime() > 0 ? 1 : 0 }
    },
    examples: [
        {
            name: "e",
            params: {},
            input: { write: false },
            output: { rows: 0, ref: "", text: "", n: 0, seen: true, at: 1 },
            effects: [],
        },
    ],
}) as unknown as NodeDefinition

const INPUT: NodeRunInput = {
    nodeId: "core.probe",
    params: {},
    input: { write: false },
    turn: { turnId: "t-1", workspaceId: "ws-1", agentId: "a-1", subject: null, conversationId: "c-1", locale: "vi" },
    grant: { rights: [READ, WRITE], tools: ["core.look"] },
    key: "run-1:node",
}

const build = async (door: NodeToolDoor | null, port: NodeDataPort, resolvers: ReadonlyArray<NodeSubjectResolver> = []) => {
    const registry = mock<GraphNodeRegistryService>()
    registry.installed.mockReturnValue(
        nodeIndexOf({ nodes: [probe], effects: [ping, unping, lost], tools: [look], dataKinds: [] }),
    )
    registry.subjectResolvers.mockReturnValue(resolvers)
    registry.nodeOf.mockReturnValue(probe)
    registry.portOf.mockReturnValue(port)
    registry.subjectResolvers.mockReturnValue([])
    const executor = mock<NodeEffectExecutor>({ effect: "core.ping" })
    executor.execute.mockResolvedValue({ kind: "record", id: "e-1" })
    registry.executorOf.mockReturnValue(executor)
    const effects = mock<GraphNodeEffectsService>()
    effects.once.mockImplementation((_workspace, _effect, _call, act) => act())
    const ai = mock<AiTasksService>()
    ai.nodeText.mockResolvedValue("hi")
    ai.nodeJson.mockResolvedValue({ n: 2 })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeHostService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: GraphNodeEffectsService, useValue: effects },
            { provide: AiTasksService, useValue: ai },
            ...(door === null ? [] : [{ provide: GRAPH_NODE_TOOL_DOOR, useValue: door }]),
        ],
    }).compile()
    return { host: moduleRef.get(GraphNodeHostService), executor, effects, ai }
}

const door = (): NodeToolDoor => ({ call: jest.fn().mockResolvedValue({ seen: true }) })

describe("GraphNodeHostService", () => {
    it("runs a node through the registered port, the ledgered executor, the model and the tool door", async () => {
        const port: NodeDataPort = { kind: "record", read: jest.fn().mockResolvedValue([{ id: "1" }]) }
        const tools = door()
        const { host, executor, effects, ai } = await build(tools, port)

        await expect(host.run(INPUT)).resolves.toEqual({
            output: { rows: 1, ref: "e-1", text: "hi", n: 2, seen: true, at: 1 },
            effects: [{ id: "core.ping", subject: { kind: "record", id: "e-1" } }],
        })
        expect(port.read).toHaveBeenCalledWith(INPUT.turn, { fields: ["id"] }, "turn")
        expect(effects.once).toHaveBeenCalledWith("ws-1", "core.ping", { key: "run-1:node:0", dedupeKey: null }, expect.any(Function))
        expect(executor.execute).toHaveBeenCalledWith(INPUT.turn, { n: 1 }, { key: "run-1:node:0", dedupeKey: null })
        expect(ai.nodeText).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "vi" },
            { purpose: "core.probe:say", instructions: "", input: null },
        )
        expect(tools.call).toHaveBeenCalledWith(INPUT.turn, "core.look", {}, "run-1:node:tool:0")
    })

    it("writes through a port that writes, and refuses a kind whose port does not", async () => {
        const write = jest.fn().mockResolvedValue({ kind: "record", id: "w-1" })
        const writing = await build(door(), { kind: "record", read: () => Promise.resolve([]), write })
        await expect(writing.host.run({ ...INPUT, input: { write: true } })).resolves.toMatchObject({ output: { ref: "w-1" } })
        expect(write).toHaveBeenCalledWith(INPUT.turn, { id: "r" })

        const readOnly = await build(door(), { kind: "record", read: () => Promise.resolve([]) })
        await expect(readOnly.host.run({ ...INPUT, input: { write: true } })).rejects.toMatchObject({
            code: GraphNodesErrorCode.PortMissing,
        })
    })

    it("refuses a tool call while no NIVO MCP door is bound", async () => {
        const { host } = await build(null, { kind: "record", read: () => Promise.resolve([]) })
        await expect(host.run(INPUT)).rejects.toMatchObject({ code: GraphNodesErrorCode.ToolDoorMissing })
    })
})

describe("GraphNodeHostService subjects and undo", () => {
    const port: NodeDataPort = { kind: "record", read: () => Promise.resolve([]) }

    it("gives a turn with no subject the first subject a resolver knows, and keeps a subject the trigger named", async () => {
        const none: NodeSubjectResolver = { subjectOf: jest.fn().mockResolvedValue(null) }
        const lead: NodeSubjectResolver = { subjectOf: jest.fn().mockResolvedValue({ kind: "sales-lead", id: "l-1" }) }
        const read = jest.fn().mockResolvedValue([])
        const { host } = await build(door(), { ...port, read }, [none, lead])

        await host.run(INPUT)
        expect(read.mock.calls[0]?.[0].subject).toEqual({ kind: "sales-lead", id: "l-1" })

        const named = { ...INPUT.turn, subject: { kind: "order", id: "o-1" } }
        await host.run({ ...INPUT, turn: named })
        expect(read.mock.calls[1]?.[0].subject).toEqual({ kind: "order", id: "o-1" })
        expect(none.subjectOf).toHaveBeenCalledTimes(1)
    })

    it("runs a turn on no subject when no resolver knows one", async () => {
        const read = jest.fn().mockResolvedValue([])
        const { host } = await build(door(), { ...port, read }, [{ subjectOf: () => Promise.resolve(null) }])
        await host.run(INPUT)
        expect(read.mock.calls[0]?.[0].subject).toBeNull()
    })

    it("undoes each effect with a compensation, last first, keyed by its place, and skips one with none", async () => {
        const { host, executor, effects } = await build(door(), port)
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
