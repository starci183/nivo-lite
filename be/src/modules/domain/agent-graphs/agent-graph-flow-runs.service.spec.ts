import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools, TOOL } from "@nivo-lite/blocks-core"
import { graphSpecProblems } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import {
    FEED_ROW,
    ORDER_ROW,
    salesWake,
    claimWake,
    flowWorldOf,
    handOffWake,
    seededGraphOf,
    teamLineOf,
} from "@tests/fixtures/builders/flow-f-world.builder"
import type { SeededGraphName } from "@tests/fixtures/builders/flow-f-world.builder"
import { driveRouted, routedWorkflowsOf } from "@tests/fixtures/builders/flow-routed-world.builder"
import { seededWorkflowsOf } from "@tests/fixtures/builders/workflow-world.builder"
import {
    CONSULT_PURPOSE,
    CREATE_ORDER_PURPOSE,
    ORDER_NOTICE_PURPOSE,
    POT_ADDRESS,
    POT_PICKS,
    SALES_FLOW_CASES,
    SEND_QR_PURPOSE,
    agreeingStore,
    agrees,
    consultReady,
    createsOrder,
    noticesOrder,
    sendsQr,
} from "@tests/fixtures/builders/sales-flow-cases.builder"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { GRAPH_FLOW_TRIGGER_MESSAGES } from "./agent-graphs.decorators"
import type { FlowTriggerConversation, FlowTriggerMessage, FlowTriggerMessages } from "./agent-graphs.port"
import { tagSourceOf, triggerScopeOf } from "./policies/graph-flow.policy"
import type { FlowWake } from "./policies/graph-flow.policy"

/** The agent each module's workflows are seeded for in the routed worlds. */
const MODULES = { accounting: "accounting-agent", chatbot: "chatbot-agent", sales: "sales-agent" } as const

/** The purposes the agents of the front desk and of the reconcile chain ask the model under (`<node id>:<purpose>`). */
const UNDERSTAND_PURPOSE = "chatbot.understand:understand"
const MATCH_PURPOSE = "accounting.match-payment:agent"
const SETTLE_PURPOSE = "payment.settle:agent"
const LEDGER_PURPOSE = "accounting.post-payment:agent"
const RECEIVED_PURPOSE = "payment.received-notice:agent"

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

const build = async (state: GraphState | null, answers: TriggerAnswers | null = null) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const runs = mock<AgentRunsService>({
        open: jest.fn().mockResolvedValue(runViewOf({ id: "run-1" })),
        append: jest.fn().mockResolvedValue(undefined),
    })
    const handlers = mock<AgentWorkHandlersService>()
    const nodes = mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue(installedNodes()) })
    const messages = mock<FlowTriggerMessages>({
        messagesOf: jest.fn().mockResolvedValue(answers?.said ?? []),
        conversationOf: jest.fn().mockResolvedValue(answers?.conversation ?? null),
    })
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef =
        answers === null
            ? await Test.createTestingModule({
                  providers: [
                      AgentGraphFlowRunsService,
                      { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
                      { provide: AgentGraphsService, useValue: graphs },
                      { provide: AgentRunsService, useValue: runs },
                      { provide: AgentWorkHandlersService, useValue: handlers },
                      { provide: GraphNodeRegistryService, useValue: nodes },
                  ],
              }).compile()
            : await Test.createTestingModule({
                  providers: [
                      AgentGraphFlowRunsService,
                      { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
                      { provide: AgentGraphsService, useValue: graphs },
                      { provide: AgentRunsService, useValue: runs },
                      { provide: AgentWorkHandlersService, useValue: handlers },
                      { provide: GraphNodeRegistryService, useValue: nodes },
                      { provide: GRAPH_FLOW_TRIGGER_MESSAGES, useValue: messages },
                  ],
              }).compile()
    return { flows: moduleRef.get(AgentGraphFlowRunsService), runs, handlers, messages }
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
        expect(runs.append).toHaveBeenCalledWith("ws-1", expect.anything(), "run-1", [
            {
                stepKey: "keep",
                nodeKey: "keep",
                kind: "graph_node",
                effect: { kind: "compensable", compensation: "graph_node" },
                input: {
                    versionId: "version-1",
                    nodeKey: "keep",
                    trigger: {
                        authorAgentId: "agent-2",
                        text: "order",
                        subject: null,
                        context: {},
                        source: "agent",
                        origin: "agent",
                        locale: "vi",
                    },
                    namespace: "sales.main",
                    workflowId: null,
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
            said,
            conversation: { leadId: "l-1", channel: "zalo" },
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
        const { flows, messages } = await build(stateWith(FLOW), { said: [], conversation: null })
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

    it("pass the installed nodes with the saga rule on, in every workflow the seed makes active for an agent", () => {
        const seeded = Object.entries(MODULES).flatMap(([module, agent]) => seededWorkflowsOf(agent, module))
        expect(seeded.map((workflow) => workflow.templateId)).toEqual([
            "accounting.reconcile",
            "accounting.reports",
            "chatbot.front-desk",
            "sales.consult",
            "sales.after-sale",
            "sales.web-order",
            "sales.payment-reminder",
            "sales.delivery-check",
            "sales.occasion",
        ])
        for (const workflow of seeded) expect(graphSpecProblems(workflow.graph, installed)).toEqual([])
    })

    // Out of date after a template change: `npm run seeds:graphs` (from the lane root, after the blocks-core build) rewrites them.
    it("keep the seed's agent graph files the newest version of the primary template of their module", () => {
        const names: ReadonlyArray<SeededGraphName> = ["sales", "chatbot", "accounting"]
        for (const name of names) {
            const primary = seededWorkflowsOf(MODULES[name], name).find((workflow) => workflow.primary)
            expect(seededGraphOf(name)).toEqual(primary?.graph)
        }
    })
})

describe("routing a wake through the workflows of an agent", () => {
    const world = () => flowWorldOf({})
    const customerLine = (channel: string): FlowWake => ({
        source: "customer",
        actorMemberId: null,
        context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: `${channel}:1`, lookupName: false },
    })
    const store = { messages: [{ id: "msg-1", body: "mua hoa", at: "2026-11-04T01:00:00.000Z" }] }

    it("takes a customer line of Zalo or Telegram with the front desk's matching trigger, and the line is trigger.text", async () => {
        const model = () => ({
            [UNDERSTAND_PURPOSE]: [{ answer: { branch: "buy", summary: "The customer wants flowers" } }],
        })
        const zalo = await driveRouted(
            flowWorldOf(store),
            routedWorkflowsOf(),
            "chatbot",
            model(),
            customerLine("zalo"),
        )
        const telegram = await driveRouted(
            flowWorldOf(store),
            routedWorkflowsOf(),
            "chatbot",
            model(),
            customerLine("telegram"),
        )

        expect([zalo.workflow, telegram.workflow]).toEqual(["front-desk", "front-desk"])
        expect(zalo.namespace).toBe("chatbot.front-desk")
        expect(zalo.trigger).toMatchObject({ triggerKey: "zalo", text: "mua hoa", conversationId: "conv-1" })
        expect(telegram.trigger).toMatchObject({ triggerKey: "telegram" })
    })

    it("takes a hand-off by its pin: only the mapped params and the calling run reach trigger.*, whatever the wake's source", async () => {
        const run = await driveRouted(world(), routedWorkflowsOf(), "sales", {}, salesWake())

        expect(run.workflow).toBe("consult")
        expect(run.namespace).toBe("sales.consult")
        expect(run.trigger).toMatchObject({
            leadId: "lead-1",
            conversationId: "conv-1",
            text: "One flower pot to 69 Hang Xanh please",
            channel: "zalo",
            caller: { agent: "chatbot-1", runId: "run-caller" },
        })
        const wake = handOffWake({ workflow: "after-sale" }, { orderId: "o-1" })
        const afterSale = await driveRouted(world(), routedWorkflowsOf(), "sales", {}, wake)
        expect(afterSale.workflow).toBe("after-sale")
        expect(afterSale.trigger).toMatchObject({ orderId: "o-1" })
        expect(afterSale.trigger).not.toHaveProperty("items")
    })

    it("sends a bank credit to the reconcile workflow by its SePay trigger, with the transaction from the subject", async () => {
        const wake: FlowWake = {
            source: "tag",
            actorMemberId: null,
            context: { text: "credit", tagSource: "sepay", subject: "bank-transaction:t-9" },
        }
        const run = await driveRouted(world(), routedWorkflowsOf(), "accounting", {}, wake)

        expect(run.workflow).toBe("reconcile")
        expect(run.trigger).toMatchObject({ triggerKey: "sepay", transactionId: "t-9" })
    })
})

describe("routing a wake by the conditions of a trigger", () => {
    const world = () => flowWorldOf({})

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
        const routed = await Promise.all(
            kinds.map((kind) => driveRouted(world(), routedWorkflowsOf(), "sales", {}, timer(kind))),
        )
        const unknown = await driveRouted(world(), routedWorkflowsOf(), "sales", {}, timer("loyalty"))

        expect(routed.map((run) => run.workflow)).toEqual(["payment-reminder", "delivery-check", "occasion"])
        expect(unknown.ending).toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(unknown.workflow).toBeNull()
        expect(unknown.path).toEqual([])
    })

    it("answers a hand-off to a workflow the agent does not run with nothing: the agent has no graph of its own that answers instead", async () => {
        const wake = handOffWake({ workflow: "ghost" }, { orderId: "o-1" })
        const run = await driveRouted(world(), routedWorkflowsOf(), "sales", {}, wake)

        expect(run.ending).toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(run.workflow).toBeNull()
    })
})

describe("flow F workflows: Sales", () => {
    it("Sales settles the order with the customer, records and confirms it, sends its QR and tells the team, each step its own agent", async () => {
        const world = flowWorldOf(agreeingStore())
        const drive = await driveRouted(world, routedWorkflowsOf(), "sales", agrees(), salesWake())

        expect(drive.failed).toBeNull()
        expect(drive.workflow).toBe("consult")
        expect(drive.path).toEqual(["consult", "create-order", "send-qr", "notify-order", "won"])
        expect(world.ran.map((entry) => entry.effect)).toEqual([
            TOOL.orderRecord,
            TOOL.orderConfirm,
            TOOL.paymentQrCreate,
            TOOL.teamMessagePost,
        ])
        // The agent types ids and quantities only: no price, no total, no order number, no key.
        expect(world.ran[0]?.payload).toEqual({
            leadId: "lead-1",
            items: [{ catalogueItemId: "c1", qty: 1 }],
            address: POT_ADDRESS,
        })
        expect(world.ran[1]?.payload).toEqual({ orderId: "order-1" })
        expect(world.ran[2]?.payload).toEqual({ orderId: "order-1" })
        expect(world.ran[3]?.payload).toEqual({ kind: "order.summary", orderId: "order-1" })
        // Each step hands the next what it answered: the draft of the consult, then the order.
        expect(drive.outputs.consult?.output).toMatchObject({ branch: "ready", leadId: "lead-1", address: POT_ADDRESS })
        expect(drive.outputs["create-order"]?.output).toEqual({ orderId: "order-1", orderNo: "DH001" })
        // The won outcome binds the outputs the consult declares, which a call-workflow step would read as out.*.
        expect(drive.outputs.won?.output).toMatchObject({ outcome: "won", values: { orderId: "order-1" } })
    })

    it("Sales ensures the lead of a customer who is none yet before the draft is ready, and the order is theirs", async () => {
        const world = flowWorldOf({ "catalogue-item": [...(agreeingStore()["catalogue-item"] ?? [])] })
        const wake = handOffWake(
            { workflow: "consult" },
            { conversationId: "conv-1", text: "One flower pot to 69 Hang Xanh please", channel: "zalo" },
        )
        const draft = { conversationId: "conv-1", channel: "zalo", items: POT_PICKS, address: POT_ADDRESS }
        const model = {
            ...agrees(),
            [CONSULT_PURPOSE]: [...consultReady({ ...draft, leadId: null, ensuredLeadId: "sales-lead-1" })],
            [CREATE_ORDER_PURPOSE]: [
                ...createsOrder({
                    leadId: "sales-lead-1",
                    items: POT_PICKS,
                    address: POT_ADDRESS,
                    orderId: "order-2",
                    orderNo: "DH001",
                }),
            ],
            [SEND_QR_PURPOSE]: [...sendsQr("order-2")],
            [ORDER_NOTICE_PURPOSE]: [...noticesOrder("order-2")],
        }
        const drive = await driveRouted(world, routedWorkflowsOf(), "sales", model, wake)

        expect(drive.failed).toBeNull()
        expect(world.ran.map((entry) => entry.effect)).toEqual([
            TOOL.leadEnsure,
            TOOL.orderRecord,
            TOOL.orderConfirm,
            TOOL.paymentQrCreate,
            TOOL.teamMessagePost,
        ])
        expect(world.ran[0]?.payload).toEqual({ conversationId: "conv-1", channel: "zalo" })
        expect(world.ran[1]?.payload).toMatchObject({ leadId: "sales-lead-1" })
    })

    it("Sales stops at the create-order step when the confirmation is down: the team is told once, nothing after it runs and no QR goes out", async () => {
        const world = flowWorldOf(agreeingStore(), TOOL.orderConfirm)
        const model = {
            ...agrees(),
            // The confirm call comes back as a refusal (a fact); the agent cannot finish the step and says so.
            [CREATE_ORDER_PURPOSE]: [
                ...createsOrder({
                    leadId: "lead-1",
                    items: POT_PICKS,
                    address: POT_ADDRESS,
                    orderId: "order-1",
                    orderNo: "DH001",
                }).slice(0, 2),
                { confused: { reason: "Khong xac nhan duoc don", question: "Anh xem giup he thong don hang?" } },
            ],
        }
        const drive = await driveRouted(world, routedWorkflowsOf(), "sales", model, salesWake())

        expect(drive.failed).toBe("create-order")
        expect(drive.path).toEqual(["consult"])
        expect(world.ran.map((entry) => entry.effect)).toEqual([TOOL.orderRecord, TOOL.teamMessagePost])
        expect(teamLineOf(world.ran.at(-1)?.payload ?? {})).toContain("ai_confused")
        expect(world.ran.some((entry) => entry.effect === TOOL.paymentQrCreate)).toBe(false)
    })
})

describe("flow F workflows: the Sales consult, its care and the website form", () => {
    it.each(SALES_FLOW_CASES.map((each) => [each.name, each] as const))("%s", async (_name, each) => {
        const world = flowWorldOf(each.store())
        const drive = await driveRouted(world, routedWorkflowsOf(), "sales", each.model(), each.wake())
        expect(drive.failed).toBeNull()
        expect(drive.workflow).toBe(each.workflow)
        expect(drive.path).toEqual(each.path)
        expect(world.ran.map((entry) => entry.effect)).toEqual(each.effects)
    })
})

describe("flow F workflows: Chatbot", () => {
    const lineWake: FlowWake = {
        source: "customer",
        actorMemberId: null,
        context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: "zalo:1", lookupName: false },
    }
    const saying = (body: string) => ({ messages: [{ id: "msg-1", body, at: "2026-11-04T01:00:00.000Z" }] })
    const understands = (branch: string) => ({
        [UNDERSTAND_PURPOSE]: [{ answer: { branch, summary: `The customer: ${branch}` } }],
    })

    it("Chatbot says nothing to a customer who wants to buy and hands them to the Sales consult with their words", async () => {
        const world = flowWorldOf(saying("Order one flower pot, deliver to 69 Hang Xanh"))
        const drive = await driveRouted(world, routedWorkflowsOf(), "chatbot", understands("buy"), lineWake)

        expect(drive.failed).toBeNull()
        expect(drive.workflow).toBe("front-desk")
        expect(drive.path).toEqual(["understand", "to-consult"])
        expect(world.ran.map((entry) => entry.effect)).toEqual([TOOL.agentTag])
        expect(world.ran[0]?.payload).toMatchObject({
            toModuleKey: "sales",
            conversationId: "conv-1",
            context: {
                workflowCall: { workflow: "consult", version: "latest" },
                params: {
                    conversationId: "conv-1",
                    text: "Order one flower pot, deliver to 69 Hang Xanh",
                    channel: "zalo",
                },
            },
        })
    })

    it("Chatbot hands a customer who says they paid to Accounting's reconcile workflow with their words, recording no claim itself", async () => {
        const world = flowWorldOf(saying("I transferred 2k"))
        const drive = await driveRouted(world, routedWorkflowsOf(), "chatbot", understands("paid"), lineWake)

        expect(drive.failed).toBeNull()
        expect(drive.path).toEqual(["understand", "to-reconcile"])
        expect(world.ran).toHaveLength(1)
        expect(world.ran[0]).toMatchObject({
            effect: TOOL.agentTag,
            payload: {
                toModuleKey: "accounting",
                context: {
                    workflowCall: { workflow: "reconcile", version: "latest" },
                    params: { conversationId: "conv-1", text: "I transferred 2k" },
                },
            },
        })
    })

    it("Chatbot answers a question itself with the customer send, and the turn ends there", async () => {
        const world = flowWorldOf(saying("When do you open?"))
        const model = {
            ...understands("question"),
            "chatbot.answer:answer": [
                { call: { tool: TOOL.customerMessageSend, args: { conversationId: "conv-1", text: "We open at 8." } } },
                { done: { reply: "We open at 8." } },
            ],
        }
        const drive = await driveRouted(world, routedWorkflowsOf(), "chatbot", model, lineWake)

        expect(drive.failed).toBeNull()
        expect(drive.path).toEqual(["understand", "answer"])
        expect(world.ran.map((entry) => [entry.effect, entry.payload.text])).toEqual([
            [TOOL.customerMessageSend, "We open at 8."],
        ])
    })

    it("Chatbot apologises to a customer who complains, tells the team, and ends on the owner outcome with the summary", async () => {
        const world = flowWorldOf(saying("The flowers arrived wilted"))
        const model = {
            ...understands("complaint"),
            "chatbot.complaint:complaint": [
                { call: { tool: TOOL.customerMessageSend, args: { conversationId: "conv-1", text: "We are sorry." } } },
                {
                    call: {
                        tool: TOOL.teamMessagePost,
                        args: {
                            kind: "message.text",
                            intent: "notify",
                            audience: "founder",
                            title: "Complaint",
                            text: "The customer says the flowers arrived wilted.",
                        },
                    },
                },
                { done: { reply: "We are sorry.", posted: true, summary: "Wilted flowers, no order number yet" } },
            ],
        }
        const drive = await driveRouted(world, routedWorkflowsOf(), "chatbot", model, lineWake)

        expect(drive.failed).toBeNull()
        expect(drive.path).toEqual(["understand", "complaint", "to-owner"])
        expect(world.ran.map((entry) => entry.effect)).toEqual([TOOL.customerMessageSend, TOOL.teamMessagePost])
        expect(drive.outputs["to-owner"]?.output).toEqual({
            outcome: "owner",
            values: { summary: "Wilted flowers, no order number yet" },
        })
    })

    it("Chatbot stops and tells the team when its AI cannot tell what the customer wants: no branch is guessed", async () => {
        const world = flowWorldOf(saying("???"))
        const model = {
            [UNDERSTAND_PURPOSE]: [{ confused: { reason: "Khong ro y khach", question: "Khach muon gi?" } }],
        }
        const drive = await driveRouted(world, routedWorkflowsOf(), "chatbot", model, lineWake)

        expect(drive.failed).toBe("understand")
        expect(drive.path).toEqual([])
        expect(world.ran.map((entry) => entry.effect)).toEqual([TOOL.teamMessagePost])
    })
})

describe("flow F workflows: Accounting", () => {
    const credit = (id: string): FlowWake => ({
        source: "tag",
        actorMemberId: null,
        context: { text: "credit", tagSource: "sepay", subject: `bank-transaction:${id}` },
    })
    const PAID_STORE = () => ({
        "bank-transaction": [
            { ...FEED_ROW, id: "t-5", amountVnd: 5000, reference: "SO-0001 chuyen khoan", status: "new" },
        ],
        order: [{ ...ORDER_ROW }],
        "sales-lead": [{ id: "lead-1", contactName: "Bui Nguyen Dinh" }],
    })
    /** The agents of a credit that pays order-1: the match names the two ids, the order is marked paid, posted and told. */
    const paysOrder = () => ({
        [MATCH_PURPOSE]: [
            {
                done: {
                    transactionId: "t-5",
                    orderId: "order-1",
                    claimId: null,
                    settle: true,
                    reason: "The code names the order",
                },
            },
        ],
        [SETTLE_PURPOSE]: [
            { call: { tool: TOOL.paymentMarkPaid, args: { orderId: "order-1", transactionId: "t-5" } } },
            { done: { result: "paid" } },
        ],
        [LEDGER_PURPOSE]: [
            { call: { tool: TOOL.ledgerAppend, args: { transactionId: "t-5" } } },
            { done: { ref: "Ledger!A2:G2" } },
        ],
        [RECEIVED_PURPOSE]: [
            { call: { tool: TOOL.teamMessagePost, args: { kind: "payment.received", orderId: "order-1" } } },
            { done: { posted: true } },
        ],
    })
    const LEDGER_DOOR = { door: { call: () => Promise.resolve({ ref: "Ledger!A2:G2" }) } }

    it("Accounting matches a bank credit to its order, marks it paid, posts it, tells the team and hands the paid order to the Sales after-sale workflow", async () => {
        const world = flowWorldOf(PAID_STORE())
        const drive = await driveRouted(
            world,
            routedWorkflowsOf(),
            "accounting",
            paysOrder(),
            credit("t-5"),
            LEDGER_DOOR,
        )

        expect(drive.failed).toBeNull()
        expect(drive.workflow).toBe("reconcile")
        expect(drive.path).toEqual(["match", "mark-paid", "ledger", "notify-paid", "to-after-sale"])
        expect(world.ran.map((entry) => entry.effect)).toEqual([
            TOOL.paymentMarkPaid,
            TOOL.teamMessagePost,
            TOOL.agentTag,
        ])
        // Only the two ids mark an order paid: the amount and the verdict are the tool's.
        expect(world.ran[0]?.payload).toEqual({ orderId: "order-1", transactionId: "t-5" })
        // The numbers of the match are read back from the records, never typed by the agent.
        expect(drive.outputs.match?.output).toMatchObject({
            branch: "matched",
            leadId: "lead-1",
            verdict: "exact",
            expectedVnd: 5000,
            receivedVnd: 5000,
        })
        expect(world.ran.at(-1)).toMatchObject({
            effect: TOOL.agentTag,
            payload: {
                toModuleKey: "sales",
                context: {
                    workflowCall: { workflow: "after-sale", version: "latest" },
                    params: { orderId: "order-1" },
                },
            },
        })
    })

    it("Accounting stops at the match and tells the team when its agent cannot tell which order a credit pays: nothing is marked paid", async () => {
        const world = flowWorldOf({
            "bank-transaction": [
                { ...FEED_ROW, id: "t-1", amountVnd: 99_000, reference: "CHUYEN TIEN", status: "new" },
            ],
        })
        const model = {
            [MATCH_PURPOSE]: [
                { confused: { reason: "Khong don nao khop 99.000d", question: "Khoan nay cua don nao?" } },
            ],
        }
        const drive = await driveRouted(world, routedWorkflowsOf(), "accounting", model, credit("t-1"))

        expect(drive.failed).toBe("match")
        expect(drive.path).toEqual([])
        expect(world.ran.map((entry) => entry.effect)).toEqual([TOOL.teamMessagePost])
        expect(teamLineOf(world.ran[0]?.payload ?? {})).toContain("bank-transaction:t-1")
    })

    it("Accounting stops at the mark-paid step when the tool refuses the transfer: the refusal is a fact the agent reads, the order stays unpaid and nothing is posted", async () => {
        const world = flowWorldOf(PAID_STORE(), TOOL.paymentMarkPaid)
        const model = {
            ...paysOrder(),
            [SETTLE_PURPOSE]: [
                { call: { tool: TOOL.paymentMarkPaid, args: { orderId: "order-1", transactionId: "t-5" } } },
                { confused: { reason: "Cong cu tu choi danh dau da tra", question: "Anh xu ly khoan nay the nao?" } },
            ],
        }
        const drive = await driveRouted(world, routedWorkflowsOf(), "accounting", model, credit("t-5"), LEDGER_DOOR)

        expect(drive.failed).toBe("mark-paid")
        expect(drive.path).toEqual(["match"])
        expect(world.ran.map((entry) => entry.effect)).toEqual([TOOL.teamMessagePost])
        expect(world.ran.some((entry) => entry.effect === TOOL.agentTag)).toBe(false)
    })
})

describe("flow F workflows: Accounting, called with a customer's word that they paid", () => {
    const STORE = () => ({
        "bank-transaction": [],
        "payment-claim": [],
        order: [{ ...ORDER_ROW }],
        "sales-lead": [{ id: "lead-1", contactName: "Bui Nguyen Dinh" }],
    })

    it("records the claim from the customer's words and ends the turn while the money has not arrived: nothing is marked paid", async () => {
        const world = flowWorldOf(STORE())
        const model = {
            [MATCH_PURPOSE]: [
                {
                    call: {
                        tool: TOOL.paymentClaimRecord,
                        args: {
                            leadId: "lead-1",
                            conversationId: "conv-1",
                            amountVnd: 5000,
                            names: [],
                            body: "I transferred 5k",
                        },
                    },
                },
                {
                    done: {
                        transactionId: null,
                        orderId: "order-1",
                        claimId: "payment-claim-1",
                        settle: false,
                        reason: "One open order of 5,000",
                    },
                },
            ],
        }
        const drive = await driveRouted(world, routedWorkflowsOf(), "accounting", model, claimWake("I transferred 5k"))

        expect(drive.failed).toBeNull()
        expect(drive.workflow).toBe("reconcile")
        // `not-arrived` has no route: the turn ends at the match, and the next bank credit starts the reconciliation again.
        expect(drive.path).toEqual(["match"])
        expect(drive.outputs.match?.output).toMatchObject({
            branch: "not-arrived",
            claimId: "payment-claim-1",
            verdict: null,
        })
        expect(world.ran.map((entry) => entry.effect)).toEqual([TOOL.paymentClaimRecord])
        expect(drive.trigger).toMatchObject({ conversationId: "conv-1", text: "I transferred 5k", leadId: "lead-1" })
    })

    it("the Chatbot passes the customer's words, conversation and channel to Accounting as the mapped params of its hand-off", () => {
        const chatbot = seededWorkflowsOf("chatbot-agent", "chatbot").find((workflow) => workflow.primary)
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
