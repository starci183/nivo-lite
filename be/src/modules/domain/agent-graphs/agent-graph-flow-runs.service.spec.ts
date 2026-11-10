import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools, TOOL } from "@nivo-lite/blocks-core"
import { graphSpecProblems, graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { seededWorkflowsOf, workflowWorldOf } from "@tests/fixtures/builders/workflow-world.builder"
import type { ModuleName } from "@tests/fixtures/builders/workflow-world.builder"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import type { FlowThreadRun, FlowThreads } from "./agent-graph-flow-runs.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { GRAPH_FLOW_TRIGGER_MESSAGES } from "./agent-graphs.decorators"
import type { FlowTriggerConversation, FlowTriggerMessage, FlowTriggerMessages } from "./agent-graphs.port"
import { tagSourceOf, triggerScopeOf } from "./policies/graph-flow.policy"
import type { FlowWake } from "./policies/graph-flow.policy"

/** The agent each module's workflows are seeded for in the routed worlds. */
const agentOf = (module: ModuleName): string => `${module}-agent`

/** A step of the spec that only records an order: every effect it runs can be undone, which no shipped node is any more. */
const RECORD_ONLY = "spec.record-order" as const

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: [], effects: [TOOL.orderRecord] },
    nodes: [
        { key: "keep", kind: "output", step: RECORD_ONLY, next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

/** The installed nodes, with the spec's own record-only step beside them. */
const installedNodes = () => {
    const index = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })
    const order = index.nodes.get("sales.create-order")
    if (order === undefined) return index
    const recordOnly: NodeDefinition = {
        ...order,
        id: RECORD_ONLY,
        effects: [TOOL.orderRecord],
        requires: [TOOL.orderRecord],
    }
    return { ...index, nodes: new Map<string, NodeDefinition>([...index.nodes, [RECORD_ONLY, recordOnly]]) }
}

/** Where the seed keeps its graph files, from this folder. */
const SEEDS_DIR = "../../../../../.starcistacks/dev/seeds/data/graphs"

/** The graph of a module as the seed ships it, parsed by the SDK's own schema. */
const seededGraphOf = (name: ModuleName): GraphSpec =>
    graphSpecSchema.parse(JSON.parse(readFileSync(join(__dirname, SEEDS_DIR, `${name}.json`), "utf8")))

const TURN = agentTurnViewOf({
    source: "tag",
    context: { authorAgentId: "agent-2", text: "order" },
})

const stateWith = (flow: GraphSpec | undefined, versionId: string | null = "version-1"): GraphState =>
    stateOf({
        activeVersionId: versionId,
        active: { nodes: [], rights: [], ...(flow === undefined ? {} : { flow }) },
    })

/** The answers the port of the trigger messages gives, when the app binds one. */
interface TriggerAnswers {
    readonly said: ReadonlyArray<FlowTriggerMessage>
    readonly conversation: FlowTriggerConversation | null
}

/** What the world is built with: the agent's own graph, the trigger messages port and the routing over seeded workflows. */
interface BuildOptions {
    readonly answers?: TriggerAnswers | null
    readonly workflows?: AgentWorkflowRunsService
}

const build = async (state: GraphState | null, options: BuildOptions = {}) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const runs = mock<AgentRunsService>({ open: jest.fn().mockResolvedValue(runViewOf({ id: "run-1" })) })
    const handlers = mock<AgentWorkHandlersService>()
    const nodes = mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue(installedNodes()) })
    const answers = options.answers ?? null
    const messages = mock<FlowTriggerMessages>({
        messagesOf: jest.fn().mockResolvedValue(answers?.said ?? []),
        conversationOf: jest.fn().mockResolvedValue(answers?.conversation ?? null),
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
            ...(answers === null ? [] : [{ provide: GRAPH_FLOW_TRIGGER_MESSAGES, useValue: messages }]),
            ...(options.workflows === undefined
                ? []
                : [{ provide: AgentWorkflowRunsService, useValue: options.workflows }]),
        ],
    }).compile()
    return { flows: moduleRef.get(AgentGraphFlowRunsService), runs, handlers, messages }
}

/** The thread runs as the flow sees them: every run they are handed is kept, in order. */
const threadsOf = (over: Partial<FlowThreads> = {}) => {
    const started: Array<FlowThreadRun> = []
    const threads = mock<FlowThreads>({
        owns: jest.fn().mockReturnValue(false),
        opened: jest.fn().mockResolvedValue(undefined),
        started: jest.fn((run: FlowThreadRun) => {
            started.push(run)
            return Promise.resolve({ status: "done" as const, reason: null, outcome: { runId: run.runId } })
        }),
        woken: jest.fn().mockResolvedValue({ status: "done", reason: null, outcome: { runId: "run-9" } }),
        ...over,
    })
    return { threads, started }
}

describe("AgentGraphFlowRunsService", () => {
    it("sets itself as the drain's flow once the app has started", async () => {
        const { flows, handlers } = await build(null)
        flows.onModuleInit()
        expect(handlers.setFlow).toHaveBeenCalledWith(flows)
    })

    it("takes a wake whose origin the active flow's trigger names, and no other", async () => {
        await expect((await build(stateWith(FLOW))).flows.takes(TURN)).resolves.toBe(true)
        const channel = agentTurnViewOf({ source: "tag", context: { conversationId: "c-1" } })
        await expect((await build(stateWith(FLOW))).flows.takes(channel)).resolves.toBe(false)
        await expect((await build(stateWith(undefined))).flows.takes(TURN)).resolves.toBe(false)
        await expect((await build(stateWith(FLOW, null))).flows.takes(TURN)).resolves.toBe(false)
        await expect((await build(null)).flows.takes(TURN)).resolves.toBe(false)
    })

    it("skips a wake when the agent no longer runs a flow, and reads a step of an uninstalled or stop node", async () => {
        const { flows, runs } = await build(stateWith(undefined))
        flows.setThreads(threadsOf().threads)
        await expect(flows.run(TURN)).resolves.toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(runs.open).not.toHaveBeenCalled()
        const input = { versionId: "v", nodeKey: "end", trigger: {} }
        expect(flows.stepOf({ key: "end", kind: "output", step: "stop" }, input).effect).toEqual({ kind: "read" })
    })

    it("keys the projected step of a node by the node, with the saga kind of what it runs", async () => {
        const { flows } = await build(stateWith(FLOW))
        const node = FLOW.nodes[0]
        if (node === undefined) throw new Error("FLOW has no first node")
        const input = { versionId: "version-1", nodeKey: "keep", trigger: { text: "order" }, namespace: "sales.main" }

        expect(flows.stepOf(node, input)).toEqual({
            stepKey: "keep",
            nodeKey: "keep",
            kind: "graph_node",
            effect: { kind: "compensable", compensation: "graph_node" },
            input,
        })
        expect(flows.stepOf(node, { ...input, item: { value: "a", index: 2 } }).stepKey).toBe("keep[2]")
    })
})

describe("AgentGraphFlowRunsService and the thread runs, the one engine", () => {
    it("opens the wake's run as a thread's and drives it under the wake's lease: no step row is written by the flow", async () => {
        const { flows, runs } = await build(stateWith(FLOW))
        const { threads } = threadsOf()
        flows.setThreads(threads)
        const lease = new AbortController().signal

        await expect(flows.run(TURN, lease)).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { runId: "run-1" },
        })

        expect(runs.open).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            trigger: "tag",
            versionId: "version-1",
            context: { ...TURN.context, threadScope: "conversation:conv-1" },
        })
        expect(threads.opened).toHaveBeenCalledWith(expect.anything(), "ws-1", "run-1")
        expect(threads.started).toHaveBeenCalledWith(
            {
                turn: TURN,
                runId: "run-1",
                versionId: "version-1",
                flow: FLOW,
                namespace: "sales.main",
                workflowId: null,
                workflowVersion: null,
                trigger: {
                    authorAgentId: "agent-2",
                    text: "order",
                    subject: null,
                    context: {},
                    source: "agent",
                    origin: "agent",
                    locale: "vi",
                },
            },
            lease,
        )
    })

    it("goes on as a thread when the wake is tried again: nothing asks which engine the run started on", async () => {
        const { flows, runs } = await build(stateWith(FLOW))
        const { threads } = threadsOf({})
        flows.setThreads(threads)

        await flows.run(agentTurnViewOf({ ...TURN, attempts: 2 }))

        expect(runs.open).toHaveBeenCalledTimes(1)
        expect(threads.started).toHaveBeenCalledTimes(1)
    })

    it("fails a workflow wake that reaches it before the thread engine registered: no run is opened, nothing runs anywhere else", async () => {
        const { flows, runs } = await build(stateWith(FLOW))

        await expect(flows.run(TURN)).rejects.toMatchObject({ code: "AGENT_GRAPHS_ENGINE_MISSING" })

        expect(runs.open).not.toHaveBeenCalled()
    })

    it("takes a wake the thread runs own and hands it over before anything else", async () => {
        const { flows, runs } = await build(null)
        const { threads } = threadsOf({ owns: jest.fn().mockReturnValue(true) })
        flows.setThreads(threads)
        const wake = agentTurnViewOf({
            source: "internal",
            context: { eventName: "engine.thread.resume", subjectId: "run-9" },
        })
        const lease = new AbortController().signal

        await expect(flows.takes(wake)).resolves.toBe(true)
        await expect(flows.run(wake, lease)).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { runId: "run-9" },
        })

        expect(threads.woken).toHaveBeenCalledWith(wake, lease)
        expect(runs.open).not.toHaveBeenCalled()
    })
})

describe("AgentGraphFlowRunsService.triggerOf", () => {
    const CHANNEL = agentTurnViewOf({
        source: "customer",
        context: {
            conversationId: "c-1",
            messageId: "m-2",
            channelEventId: "e-2",
            lookupName: false,
            mergedMessageIds: "m-1,m-3",
        },
    })
    const said = [
        { id: "m-1", text: "Hello shop", at: "2026-11-04T01:00:00.000Z", attachments: [] },
        {
            id: "m-2",
            text: "Transfer done",
            at: "2026-11-04T01:00:05.000Z",
            attachments: [{ id: "f-1", name: "bidv.jpg", contentType: "image/jpeg", url: "https://files.test/f-1" }],
        },
    ]

    it("reads the words, times and files of every customer message a channel wake answers, in the order they were said", async () => {
        const { flows, messages } = await build(stateWith(FLOW), {
            answers: { said, conversation: { leadId: "l-1", channel: "zalo" } },
        })

        const trigger = await flows.triggerOf(CHANNEL)

        expect(messages.messagesOf).toHaveBeenCalledWith("ws-1", "c-1", ["m-2", "m-1", "m-3"])
        expect(trigger).toMatchObject({
            conversationId: "c-1",
            origin: "channel",
            text: "Hello shop\nTransfer done",
            messageIds: ["m-1", "m-2"],
            messages: said,
        })
    })

    it("reads the one message of a wake with no burst, keeps a tag's own words, and reads nothing without the port", async () => {
        const { flows, messages } = await build(stateWith(FLOW), { answers: { said: [], conversation: null } })
        const single = agentTurnViewOf({
            source: "customer",
            context: { conversationId: "c-1", messageId: "m-2", channelEventId: "e-2" },
        })

        await expect(flows.triggerOf(single)).resolves.toMatchObject({
            text: "",
            messageIds: [],
            leadId: null,
            channel: null,
        })
        expect(messages.messagesOf).toHaveBeenCalledWith("ws-1", "c-1", ["m-2"])
        await expect(flows.triggerOf(TURN)).resolves.toMatchObject({ text: "order" })
        expect(messages.messagesOf).toHaveBeenCalledTimes(1)

        const bare = await build(stateWith(FLOW))
        await expect(bare.flows.triggerOf(single)).resolves.not.toHaveProperty("text")
    })
})

describe("flow F graphs on fake ports", () => {
    const installed = nodeIndexOf({
        nodes: coreNodes,
        effects: coreEffects,
        tools: coreTools,
        dataKinds: coreDataKinds,
    })
    const modules: ReadonlyArray<ModuleName> = ["accounting", "chatbot", "sales"]

    it("pass the installed nodes with the saga rule on, in every workflow the seed makes active for an agent", () => {
        const seeded = modules.flatMap((module) => seededWorkflowsOf(agentOf(module), module))
        expect(seeded.map((workflow) => workflow.templateId)).toEqual([
            "accounting.reconcile",
            "accounting.reports",
            "accounting.team-chat",
            "chatbot.front-desk",
            "chatbot.team-chat",
            "sales.consult",
            "sales.after-sale",
            "sales.web-order",
            "sales.payment-reminder",
            "sales.delivery-check",
            "sales.occasion",
            "sales.team-chat",
        ])
        for (const workflow of seeded) expect(graphSpecProblems(workflow.graph, installed)).toEqual([])
    })

    // Out of date after a template change: `npm run seeds:graphs` (from the lane root, after the blocks-core build) rewrites them.
    it("keep the seed's agent graph files the newest version of the primary template of their module", () => {
        for (const name of modules) {
            const primary = seededWorkflowsOf(agentOf(name), name).find((workflow) => workflow.primary)
            expect(seededGraphOf(name)).toEqual(primary?.graph)
        }
    })
})

/** The wake of the end hand-off a workflow writes for another: the words, the pin of the target, ONLY the params it maps, the caller. */
const handOffWake = (workflow: string, params: Readonly<Record<string, unknown>>, text: string = ""): FlowWake => {
    const context: AgentWakeContext = {
        text,
        tagContext: JSON.stringify({
            workflowCall: { workflow, version: "latest" },
            params,
            caller: { runId: "run-caller" },
        }),
        ...(typeof params.conversationId === "string" ? { conversationId: params.conversationId } : {}),
        ...(typeof params.leadId === "string" ? { leadId: params.leadId } : {}),
        locale: "vi",
        authorAgentId: "chatbot-1",
    }
    return { source: "tag", actorMemberId: null, context }
}

/** How a wake was routed: how its start ended, the workflow its run was pinned to, and the run the thread engine was handed. */
interface Routed {
    readonly ending: unknown
    readonly workflow: string | null
    readonly run: FlowThreadRun | null
}

/**
 * Hands a wake to the REAL start of the run of an agent whose workflows were seeded from the templates: the real routing picks the
 * workflow (by the pin of a hand-off, else by a trigger's source, channel and conditions), the run is opened, pinned and handed to the
 * thread runs (a double here), which is where the routing ends.
 */
const routed = async (
    module: ModuleName,
    wake: FlowWake,
    said: ReadonlyArray<FlowTriggerMessage> = [],
): Promise<Routed> => {
    const world = workflowWorldOf({
        [agentOf("chatbot")]: "chatbot",
        [agentOf("sales")]: "sales",
        [agentOf("accounting")]: "accounting",
    })
    const { flows } = await build(null, { answers: { said, conversation: null }, workflows: world.service })
    const { threads, started } = threadsOf()
    flows.setThreads(threads)
    const turn = agentTurnViewOf({
        agentId: agentOf(module),
        source: wake.source,
        actorMemberId: wake.actorMemberId,
        context: structuredClone(wake.context),
    })
    const ending = await flows.run(turn)
    return {
        ending,
        workflow: world.pins.get("run-1")?.workflowId.split(":").at(-1) ?? null,
        run: started.at(0) ?? null,
    }
}

describe("routing a wake through the workflows of an agent", () => {
    const customerLine = (channel: string): FlowWake => ({
        source: "customer",
        actorMemberId: null,
        context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: `${channel}:1`, lookupName: false },
    })
    const line = [{ id: "msg-1", text: "mua hoa", at: "2026-11-04T01:00:00.000Z", attachments: [] }]

    it("takes a customer line of Zalo or Telegram with the front desk's matching trigger, and the line is trigger.text", async () => {
        const zalo = await routed("chatbot", customerLine("zalo"), line)
        const telegram = await routed("chatbot", customerLine("telegram"), line)

        expect([zalo.workflow, telegram.workflow]).toEqual(["front-desk", "front-desk"])
        expect(zalo.run?.namespace).toBe("chatbot.front-desk")
        expect(zalo.run?.trigger).toMatchObject({ triggerKey: "zalo", text: "mua hoa", conversationId: "conv-1" })
        expect(telegram.run?.trigger).toMatchObject({ triggerKey: "telegram" })
    })

    it("takes a hand-off by its pin: only the mapped params and the calling run reach trigger.*, whatever the wake's source", async () => {
        const words = "One flower pot to 69 Hang Xanh please"
        const consult = await routed(
            "sales",
            handOffWake("consult", { leadId: "lead-1", conversationId: "conv-1", text: words, channel: "zalo" }, words),
        )

        expect(consult.workflow).toBe("consult")
        expect(consult.run?.namespace).toBe("sales.consult")
        expect(consult.run?.workflowId).toBe("sales-agent:consult")
        expect(consult.run?.trigger).toMatchObject({
            leadId: "lead-1",
            conversationId: "conv-1",
            text: words,
            channel: "zalo",
            caller: { agent: "chatbot-1", runId: "run-caller" },
        })
        const afterSale = await routed("sales", handOffWake("after-sale", { orderId: "o-1" }))
        expect(afterSale.workflow).toBe("after-sale")
        expect(afterSale.run?.trigger).toMatchObject({ orderId: "o-1" })
        expect(afterSale.run?.trigger).not.toHaveProperty("items")
    })

    it("sends a bank credit to the reconcile workflow by its SePay trigger, with the transaction from the subject", async () => {
        const wake: FlowWake = {
            source: "tag",
            actorMemberId: null,
            context: { text: "credit", tagSource: "sepay", subject: "bank-transaction:t-9" },
        }
        const run = await routed("accounting", wake)

        expect(run.workflow).toBe("reconcile")
        expect(run.run?.trigger).toMatchObject({ triggerKey: "sepay", transactionId: "t-9" })
    })

    it("sends a customer's word that they paid to the reconcile workflow by the pin of the Chatbot's hand-off", async () => {
        const text = "I transferred 5k"
        const run = await routed(
            "accounting",
            handOffWake("reconcile", { leadId: "lead-1", conversationId: "conv-1", text, channel: "zalo" }, text),
        )

        expect(run.workflow).toBe("reconcile")
        expect(run.run?.trigger).toMatchObject({ conversationId: "conv-1", text, leadId: "lead-1" })
    })
})

describe("routing a wake by the conditions of a trigger", () => {
    it("sends a care timer to the workflow whose condition its careKind meets, and a timer of no workflow starts nothing", async () => {
        const timer = (careKind: string): FlowWake => ({
            source: "tag",
            actorMemberId: null,
            context: {
                text: "care.due",
                tagSource: "care",
                subject: "order:order-1",
                tagContext: JSON.stringify({
                    event: "care.due",
                    careKind,
                    ref: "order-1",
                    suffix: "",
                    dueAt: "2026-11-04T10:00:00.000Z",
                }),
            },
        })
        const kinds = ["payment-stale", "delivery-check", "occasion"]
        const runs = await Promise.all(kinds.map((kind) => routed("sales", timer(kind))))
        const unknown = await routed("sales", timer("loyalty"))

        expect(runs.map((run) => run.workflow)).toEqual(["payment-reminder", "delivery-check", "occasion"])
        expect(unknown.ending).toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(unknown.workflow).toBeNull()
        expect(unknown.run).toBeNull()
    })

    it("answers a hand-off to a workflow the agent does not run with nothing: the agent has no graph of its own that answers instead", async () => {
        const run = await routed("sales", handOffWake("ghost", { orderId: "o-1" }))

        expect(run.ending).toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(run.workflow).toBeNull()
        expect(run.run).toBeNull()
    })

    it("the Chatbot passes the customer's words, conversation and channel to Accounting as the mapped params of its hand-off", () => {
        const chatbot = seededWorkflowsOf(agentOf("chatbot"), "chatbot").find((workflow) => workflow.primary)
        const handoff = chatbot?.graph.nodes.find((node) => node.key === "to-reconcile")

        expect(handoff?.params).toMatchObject({
            agent: "accounting",
            workflow: "reconcile",
            inputs: {
                conversationId: { $ref: "trigger.conversationId" },
                text: { $ref: "trigger.text" },
                channel: { $ref: "trigger.channel" },
            },
        })
    })
})

describe("the origin of the wakes the connections start", () => {
    it("takes an inbound message of a connection (Zalo OA or Telegram) as a channel origin, which the chatbot graph's trigger accepts", () => {
        const wake: FlowWake = {
            source: "customer",
            actorMemberId: null,
            context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: "zalo:1", lookupName: true },
        }

        expect(tagSourceOf(wake)).toBe("channel")
        expect(seededGraphOf("chatbot").trigger.sources).toContain(tagSourceOf(wake))
        expect(triggerScopeOf(wake)).toMatchObject({ origin: "channel", source: "channel", conversationId: "conv-1" })
    })

    it("takes the tag the bank feed writes for a new credit as a system event, which the accounting graph's trigger accepts", () => {
        const wake: FlowWake = {
            source: "tag",
            actorMemberId: null,
            context: { text: "Money in", tagSource: "bank_feed", subject: "bank-transaction:tx-1" },
        }

        expect(tagSourceOf(wake)).toBe("system-event")
        expect(seededGraphOf("accounting").trigger.sources).toContain(tagSourceOf(wake))
        expect(triggerScopeOf(wake)).toMatchObject({
            origin: "system-event",
            source: "bank_feed",
            subject: { kind: "bank-transaction", id: "tx-1" },
        })
    })
})
