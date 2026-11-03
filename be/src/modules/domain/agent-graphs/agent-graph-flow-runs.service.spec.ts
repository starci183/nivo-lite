import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { z } from "zod"
import { defineEffect, defineNode, nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { RunView } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { GRAPH_FLOW_TRIGGER_MESSAGES } from "./agent-graphs.decorators"
import type { FlowTriggerMessages } from "./agent-graphs.port"

const undo = defineEffect({ id: "order.void", title: { key: "v" }, payload: z.object({ id: z.string() }), rights: [] })
const record = defineEffect({ ...undo, id: "order.record", compensation: "order.void" })

const keep = defineNode({
    id: "order.keep",
    role: "output",
    title: { key: "k" },
    params: z.object({}),
    input: z.object({}),
    output: z.object({}),
    rights: [],
    effects: ["order.record"],
    run: () => Promise.resolve({}),
    examples: [{ name: "e", params: {}, input: {}, output: {}, effects: [] }],
}) as unknown as NodeDefinition

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: [], effects: ["order.record"] },
    nodes: [
        { key: "keep", kind: "output", step: "order.keep", next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

const TURN = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    wakeId: "wake-1",
    source: "tag",
    context: { authorAgentId: "agent-2", text: "order" },
    actorMemberId: null,
} as unknown as AgentTurnView

const stateWith = (flow: GraphSpec | undefined, versionId: string | null = "version-1"): GraphState =>
    ({ activeVersionId: versionId, active: { nodes: [], rights: [], ...(flow === undefined ? {} : { flow }) } }) as unknown as GraphState

const build = async (state: GraphState | null, messages: FlowTriggerMessages | null = null) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const runs = mock<AgentRunsService>({
        open: jest.fn().mockResolvedValue({ id: "run-1" } as RunView),
        append: jest.fn().mockResolvedValue(undefined),
    })
    const handlers = mock<AgentWorkHandlersService>()
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest.fn().mockReturnValue(nodeIndexOf({ nodes: [keep], effects: [record, undo], tools: [], dataKinds: [] })),
    })
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphFlowRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: GraphNodeRegistryService, useValue: nodes },
            ...(messages === null ? [] : [{ provide: GRAPH_FLOW_TRIGGER_MESSAGES, useValue: messages }]),
        ],
    }).compile()
    return { flows: moduleRef.get(AgentGraphFlowRunsService), runs, handlers }
}

describe("AgentGraphFlowRunsService", () => {
    it("sets itself as the drain's flow once the app has started", async () => {
        const { flows, handlers } = await build(null)
        flows.onModuleInit()
        expect(handlers.setFlow).toHaveBeenCalledWith(flows)
    })

    it("takes a wake whose origin the active flow's trigger names, and no other", async () => {
        await expect((await build(stateWith(FLOW))).flows.takes(TURN)).resolves.toBe(true)
        const channel = { ...TURN, context: { conversationId: "c-1" } } as unknown as AgentTurnView
        await expect((await build(stateWith(FLOW))).flows.takes(channel)).resolves.toBe(false)
        await expect((await build(stateWith(undefined))).flows.takes(TURN)).resolves.toBe(false)
        await expect((await build(stateWith(FLOW, null))).flows.takes(TURN)).resolves.toBe(false)
        await expect((await build(null)).flows.takes(TURN)).resolves.toBe(false)
    })

    it("opens the wake's run and writes the first node's step, compensable when its effects undo", async () => {
        const { flows, runs } = await build(stateWith(FLOW))

        await expect(flows.run(TURN)).resolves.toEqual({ status: "done", reason: null, outcome: { runId: "run-1" } })

        expect(runs.open).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            trigger: "tag",
            versionId: "version-1",
            context: TURN.context,
        })
        expect(runs.append).toHaveBeenCalledWith(expect.anything(), "run-1", [
            {
                stepKey: "keep",
                nodeKey: "keep",
                kind: "graph_node",
                effect: { kind: "compensable", compensation: "graph_node" },
                input: {
                    versionId: "version-1",
                    nodeKey: "keep",
                    trigger: expect.objectContaining({ text: "order", origin: "agent", context: {} }),
                },
            },
        ])
    })

    it("skips a wake when the agent no longer runs a flow, and reads a step of an uninstalled or stop node", async () => {
        const { flows, runs } = await build(stateWith(undefined))
        await expect(flows.run(TURN)).resolves.toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(runs.open).not.toHaveBeenCalled()
        const input = { versionId: "v", nodeKey: "end", trigger: {} }
        expect(flows.stepOf({ key: "end", kind: "output", step: "stop" }, input).effect).toEqual({ kind: "read" })
    })
})

describe("AgentGraphFlowRunsService.triggerOf", () => {
    const CHANNEL = {
        ...TURN,
        source: "customer",
        context: { conversationId: "c-1", messageId: "m-2", channelEventId: "e-2", lookupName: false, mergedMessageIds: "m-1,m-3" },
    } as unknown as AgentTurnView
    const said = [
        { id: "m-1", text: "Chào shop", at: "2026-11-04T01:00:00.000Z", attachments: [] },
        {
            id: "m-2",
            text: "Đã chuyển khoản",
            at: "2026-11-04T01:00:05.000Z",
            attachments: [{ id: "f-1", name: "bidv.jpg", contentType: "image/jpeg", url: "https://files.test/f-1" }],
        },
    ]

    it("reads the words, times and files of every customer message a channel wake answers, in the order they were said", async () => {
        const messages = mock<FlowTriggerMessages>({
            messagesOf: jest.fn().mockResolvedValue(said),
            conversationOf: jest.fn().mockResolvedValue({ leadId: "l-1", channel: "zalo" }),
        })
        const { flows } = await build(stateWith(FLOW), messages)

        const trigger = await flows.triggerOf(CHANNEL)

        expect(messages.messagesOf).toHaveBeenCalledWith("ws-1", "c-1", ["m-2", "m-1", "m-3"])
        expect(trigger).toMatchObject({
            conversationId: "c-1",
            origin: "channel",
            text: "Chào shop\nĐã chuyển khoản",
            messageIds: ["m-1", "m-2"],
            messages: said,
        })
    })

    it("reads the one message of a wake with no burst, keeps a tag's own words, and reads nothing without the port", async () => {
        const messages = mock<FlowTriggerMessages>({
            messagesOf: jest.fn().mockResolvedValue([]),
            conversationOf: jest.fn().mockResolvedValue(null),
        })
        const { flows } = await build(stateWith(FLOW), messages)
        const single = { ...CHANNEL, context: { conversationId: "c-1", messageId: "m-2", channelEventId: "e-2" } } as unknown as AgentTurnView

        await expect(flows.triggerOf(single)).resolves.toMatchObject({ text: "", messageIds: [], leadId: null, channel: null })
        expect(messages.messagesOf).toHaveBeenCalledWith("ws-1", "c-1", ["m-2"])
        await expect(flows.triggerOf(TURN)).resolves.toMatchObject({ text: "order" })
        expect(messages.messagesOf).toHaveBeenCalledTimes(1)

        const bare = await build(stateWith(FLOW))
        await expect(bare.flows.triggerOf(single)).resolves.not.toHaveProperty("text")
    })
})
