import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, type MockOf } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import type { Mutation } from "@nivo-lite/agent-sdk/mutation"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWakeService, AgentWorkHandlersService } from "@modules/domain/agent-work"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { pageOf, wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { runViewOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { ChannelSendExecutorService } from "@modules/domain/chat-node-ports"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { CHAT_WORKSPACE } from "@tests/fixtures/builders/chat-records.builder"
import {
    DOOR_AGENT,
    KEEPER_AGENT,
    SPEAKING_CUSTOMER,
    speakingChat,
    speakingTurnOf,
} from "@tests/fixtures/builders/chat-speaking.builder"
import { AgentGraphRunNoticesService } from "./agent-graph-run-notices.service"
import { AgentGraphConversationHoldsService, HOLD_TTL_MS } from "./agent-graph-conversation-holds.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphFreezeGateService } from "./agent-graph-freeze-gate.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { GRAPH_FLOW_TRIGGER_MESSAGES } from "./agent-graphs.decorators"
import type { FlowTriggerMessages } from "./agent-graphs.port"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import type { RouteWake, WorkflowRoute } from "./agent-workflows.contracts"

const SALES = "sales-agent"
const FRONT = "front-agent"
const CONVERSATION = "c-1"

/** The step of the consult that talks to the customer: an installed node that may run the customer send. */
const SPEAKING_STEP = "sales.consult-turn"

/** The Sales consult: it keeps the conversation between its turns, and ends for good on an outcome. */
const CONSULT: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent", "channel"] },
    grant: { rights: [], tools: [], effects: [] },
    entry: { openTo: "any", holdsConversation: true },
    nodes: [
        { key: "reply", kind: "output", step: SPEAKING_STEP },
        { key: "done", kind: "output", step: "core.outcome" },
    ],
}

/** The front door: every channel line lands here first. */
const FRONT_DESK: GraphSpec = { ...CONSULT, moduleKey: "chatbot", entry: { openTo: "any" } }

const NOW = "2026-11-09T10:00:00.000Z"

const lineOf = (agentId: string, text: string) =>
    agentTurnViewOf({
        agentId,
        wakeId: `wake-${text}`,
        eventKey: `msg-${text}`,
        source: "customer",
        scopeKey: `conversation:${CONVERSATION}`,
        context: { conversationId: CONVERSATION, messageId: `m-${text}` },
    })

/** How a spec builds the engine: a frozen lead, and workflows that route a pinned wake to the consult. */
interface BuildOptions {
    readonly frozen?: boolean
    readonly pinned?: boolean
}

/** The consult as a workflow whose only trigger is a call: no channel line routes to it by its triggers. */
const CONSULT_ROUTE: WorkflowRoute = {
    agentId: SALES,
    workflowId: "wf-consult",
    workflowKey: "consult",
    versionId: "wfv-1",
    workflowVersionId: "wfv-1",
    workflowVersion: 1,
    flow: { ...CONSULT, trigger: { kind: "tag", sources: ["agent"] } },
}

/** Makes the workflows route a wake pinned to the consult straight to it, and the messages answer the customer's words. */
const wirePinned = (workflows: AgentWorkflowRunsService, messages: FlowTriggerMessages): void => {
    jest.mocked(workflows.workflowKeyOfRun).mockResolvedValue("consult")
    jest.mocked(workflows.route).mockImplementation((_ws: string, agentId: string, wake: RouteWake) =>
        Promise.resolve(agentId === SALES && wake.pin?.workflow === "consult" ? CONSULT_ROUTE : null),
    )
    jest.mocked(workflows.pinRun).mockResolvedValue(undefined)
    jest.mocked(messages.messagesOf).mockResolvedValue([{ id: "m-ok-anh", text: "ok anh", at: NOW, attachments: [] }])
    jest.mocked(messages.conversationOf).mockResolvedValue({ leadId: "lead-1", channel: "zalo" })
}

/** Keeps the holds of the engine and the mutations in an in-memory store of the one hold a conversation has. */
const wireHolds = (
    engine: MockOf<EntityEngineService>,
    mutations: MockOf<EntityMutationService>,
): Map<string, RecordRow> => {
    const rows = new Map<string, RecordRow>()
    wireScope(engine)
    engine.list.mockImplementation(() => Promise.resolve(pageOf([...rows.values()])))
    mutations.mutate.mockImplementation((_tx: unknown, mutation: Mutation) => {
        if (mutation.op === "delete") rows.delete(mutation.key)
        if (mutation.op !== "upsert") return Promise.resolve({ ok: false as const, reason: "missing" as const })
        const row: RecordRow = {
            id: "hold-1",
            workspaceId: "ws-1",
            version: "1",
            createdAt: NOW,
            updatedAt: NOW,
            data: { ...mutation.values },
        }
        rows.set(row.id, row)
        return Promise.resolve({ ok: true as const, row, version: row.version })
    })
    return rows
}

/** The holds over an in-memory store of one conversation's hold, with the run start of both agents' graphs. */
const build = async ({ frozen = false, pinned = false }: BuildOptions = {}) => {
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    const rows = wireHolds(engine, mutations)
    const wakes = mock<AgentWakeService>({ write: jest.fn().mockResolvedValue("wake-sent") })
    const graphs = mock<AgentGraphsService>({
        documentOf: jest.fn((_ws: string, agentId: string) =>
            Promise.resolve({ nodes: [], rights: [], flow: agentId === SALES ? CONSULT : FRONT_DESK }),
        ),
        stateOfAgent: jest.fn((_ws: string, agentId: string) =>
            Promise.resolve(
                stateOf({
                    activeVersionId: "v-1",
                    active: { nodes: [], rights: [], flow: agentId === SALES ? CONSULT : FRONT_DESK },
                }),
            ),
        ),
    })
    const runs = mock<AgentRunsService>({
        open: jest.fn().mockResolvedValue(runViewOf({ id: "run-new" })),
        append: jest.fn().mockResolvedValue(undefined),
    })
    const freezes = mock<AgentGraphFreezeGateService>({
        hold: jest.fn().mockResolvedValue(frozen),
        frozen: jest.fn().mockResolvedValue(false),
        waitingOf: jest.fn().mockResolvedValue([]),
    })
    const workflows = mock<AgentWorkflowRunsService>()
    const messages = mock<FlowTriggerMessages>()
    wirePinned(workflows, messages)
    const clock = new FakeClock(NOW)
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphConversationHoldsService,
            AgentGraphFlowRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentWorkHandlersService, useValue: mock<AgentWorkHandlersService>() },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({
                    installed: jest.fn().mockReturnValue({ nodes: new Map() }),
                }),
            },
            { provide: AgentGraphFreezeGateService, useValue: freezes },
            ...(pinned
                ? [
                      { provide: AgentWorkflowRunsService, useValue: workflows },
                      { provide: GRAPH_FLOW_TRIGGER_MESSAGES, useValue: messages },
                  ]
                : []),
        ],
    }).compile()
    return {
        holds: moduleRef.get(AgentGraphConversationHoldsService),
        flows: moduleRef.get(AgentGraphFlowRunsService),
        rows,
        wakes,
        runs,
        freezes,
        clock,
        workflows,
    }
}

/** The last step of a Sales turn at a node, in the customer's conversation. */
const endOfSalesTurn = (nodeKey: string) => ({
    step: stepViewOf({ workspaceId: "ws-1", agentId: SALES, runId: "run-s1", nodeKey, stepKey: nodeKey }),
    input: { versionId: "v-1", nodeKey, trigger: { conversationId: CONVERSATION } },
})

describe("AgentGraphConversationHoldsService: who keeps the conversation", () => {
    it("keeps the conversation for the consult after a turn that ends without an outcome, and lets it go on its outcome", async () => {
        const { holds, rows } = await build()
        const reply = endOfSalesTurn("reply")

        await expect(holds.keptAfter(reply.step, reply.input, CONVERSATION)).resolves.toBe(true)
        await expect(holds.holderOf("ws-1", CONVERSATION)).resolves.toMatchObject({ agentId: SALES, runId: "run-s1" })

        const done = endOfSalesTurn("done")
        await expect(holds.keptAfter(done.step, done.input, CONVERSATION)).resolves.toBe(false)
        expect(rows.size).toBe(0)
    })

    it("keeps nothing for a workflow that does not hold the conversation", async () => {
        const { holds, rows } = await build()
        const front = { ...endOfSalesTurn("reply"), step: stepViewOf({ agentId: FRONT, nodeKey: "reply" }) }
        await expect(holds.keptAfter(front.step, front.input, CONVERSATION)).resolves.toBe(false)
        expect(rows.size).toBe(0)
    })

    it("lets a hold lapse after a day with no turn of its agent", async () => {
        const { holds, clock } = await build()
        const reply = endOfSalesTurn("reply")
        await holds.keptAfter(reply.step, reply.input, CONVERSATION)
        clock.advance(HOLD_TTL_MS)
        await expect(holds.holderOf("ws-1", CONVERSATION)).resolves.toBeNull()
    })
})

describe("AgentGraphConversationHoldsService: a keeper whose workflow waits for the founder", () => {
    /** The consult keeps the conversation from a run of the workflow `wf-consult`. */
    const keptByConsult = async (holds: AgentGraphConversationHoldsService): Promise<void> => {
        const reply = endOfSalesTurn("reply")
        await holds.keptAfter(reply.step, { ...reply.input, workflowId: "wf-consult" }, CONVERSATION)
    }

    it("keeps the workflow of the run with the hold", async () => {
        const { holds } = await build()
        await keptByConsult(holds)

        await expect(holds.holderOf("ws-1", CONVERSATION)).resolves.toMatchObject({
            agentId: SALES,
            workflowId: "wf-consult",
        })
    })

    it("does not send the customer's line on to a keeper whose workflow is frozen: the agent it reached serves it", async () => {
        const { holds, flows, wakes, runs, freezes } = await build()
        await keptByConsult(holds)
        freezes.frozen.mockResolvedValue(true)

        await expect(holds.redirected(lineOf(FRONT, "ok-anh"))).resolves.toBe(false)
        await expect(flows.run(lineOf(FRONT, "ok-anh"))).resolves.toMatchObject({ status: "done" })

        // The gate is asked about the keeper's workflow for this conversation, and nothing is recorded or written for the keeper.
        expect(freezes.frozen).toHaveBeenCalledWith("ws-1", { conversationId: CONVERSATION, workflowId: "wf-consult" })
        expect(wakes.write).not.toHaveBeenCalled()
        expect(runs.open).toHaveBeenCalledTimes(1)
    })

    it("sends the line on again once the keeper's workflow is released", async () => {
        const { holds, wakes, freezes } = await build()
        await keptByConsult(holds)
        freezes.frozen.mockResolvedValueOnce(true).mockResolvedValue(false)

        await expect(holds.redirected(lineOf(FRONT, "ok-anh"))).resolves.toBe(false)
        await expect(holds.redirected(lineOf(FRONT, "cam-on"))).resolves.toBe(true)

        expect(wakes.write).toHaveBeenCalledTimes(1)
        expect(wakes.write).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ agentId: SALES }))
    })

    it("asks the gate nothing for a line to the keeper itself, or for a wake that is no customer line", async () => {
        const { holds, freezes } = await build()
        await keptByConsult(holds)

        await expect(holds.redirected(lineOf(SALES, "ok-anh"))).resolves.toBe(false)
        await expect(holds.redirected({ ...lineOf(FRONT, "tag"), source: "tag" })).resolves.toBe(false)

        expect(freezes.frozen).not.toHaveBeenCalled()
    })
})

describe("AgentGraphConversationHoldsService: the customer's follow-up during an open consult", () => {
    it("sends 'ok anh' on to Sales and starts no front-door run, then after the consult's outcome the front door answers again", async () => {
        const { holds, flows, wakes, runs } = await build()
        const reply = endOfSalesTurn("reply")
        await holds.keptAfter(reply.step, reply.input, CONVERSATION)

        await expect(flows.run(lineOf(FRONT, "ok-anh"))).resolves.toEqual({
            status: "skipped",
            reason: "conversation_held",
            outcome: null,
        })
        expect(runs.open).not.toHaveBeenCalled()
        expect(wakes.write).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                agentId: SALES,
                source: "customer",
                eventKey: `msg-ok-anh~held-by-${SALES}`,
                context: { conversationId: CONVERSATION, messageId: "m-ok-anh" },
            }),
        )

        await expect(flows.run(lineOf(SALES, "ok-anh"))).resolves.toMatchObject({ status: "done" })

        const done = endOfSalesTurn("done")
        await holds.keptAfter(done.step, done.input, CONVERSATION)
        await expect(flows.run(lineOf(FRONT, "cam-on"))).resolves.toMatchObject({ status: "done" })
        expect(wakes.write).toHaveBeenCalledTimes(1)
    })

    it("still holds a frozen lead: the line sent on to Sales starts no run there either", async () => {
        const { holds, flows, runs, freezes } = await build({ frozen: true })
        const reply = endOfSalesTurn("reply")
        await holds.keptAfter(reply.step, reply.input, CONVERSATION)

        await expect(flows.run(lineOf(FRONT, "ok-anh"))).resolves.toMatchObject({
            status: "skipped",
            reason: "conversation_held",
        })
        await expect(flows.run(lineOf(SALES, "ok-anh"))).resolves.toEqual({
            status: "held",
            reason: "lead_frozen",
            outcome: null,
        })
        expect(freezes.hold).toHaveBeenCalledTimes(1)
        expect(runs.open).not.toHaveBeenCalled()
    })

    it("passes any wake that is not a customer's line, and a line with no conversation", async () => {
        const { holds } = await build()
        const reply = endOfSalesTurn("reply")
        await holds.keptAfter(reply.step, reply.input, CONVERSATION)
        await expect(holds.redirected({ ...lineOf(FRONT, "x"), source: "tag" })).resolves.toBe(false)
        await expect(holds.redirected({ ...lineOf(FRONT, "x"), context: {} })).resolves.toBe(false)
    })
})

describe("AgentGraphConversationHoldsService: the line reaches the consult as its customer turn", () => {
    it("pins the line sent on to the consult's workflow, so a consult no channel trigger takes still runs it with the customer's words", async () => {
        const { holds, flows, wakes, runs, workflows } = await build({ pinned: true })
        const reply = endOfSalesTurn("reply")
        await holds.keptAfter(reply.step, reply.input, CONVERSATION)

        await expect(flows.run(lineOf(FRONT, "ok-anh"))).resolves.toMatchObject({ reason: "conversation_held" })
        const sent = wakes.write.mock.calls[0]?.[1]
        expect(sent?.context).toEqual({
            conversationId: CONVERSATION,
            messageId: "m-ok-anh",
            tagContext: JSON.stringify({ workflowCall: { workflow: "consult", version: "latest" } }),
        })

        const keeperLine = { ...lineOf(SALES, "ok-anh"), wakeId: "wake-sent", context: sent?.context ?? {} }
        await expect(flows.run(keeperLine)).resolves.toMatchObject({ status: "done" })

        expect(workflows.route).toHaveBeenLastCalledWith(
            "ws-1",
            SALES,
            expect.objectContaining({ pin: { workflow: "consult", version: "latest" } }),
        )
        expect(workflows.pinRun).toHaveBeenCalledWith(expect.anything(), "ws-1", "run-new", CONSULT_ROUTE)
        const [first] = runs.append.mock.calls[0]?.[3] ?? []
        expect(first?.input).toMatchObject({
            versionId: "wfv-1",
            workflowId: "wf-consult",
            trigger: {
                conversationId: CONVERSATION,
                leadId: "lead-1",
                channel: "zalo",
                text: "ok anh",
                messageIds: ["m-ok-anh"],
            },
        })
    })
})

const DOOR_ID = DOOR_AGENT
const KEEPER_ID = KEEPER_AGENT

/** The Sales consult: it keeps the conversation between its turns. */
const KEEPING_CONSULT: GraphSpec = { ...CONSULT, trigger: { kind: "tag", sources: ["agent"] } }

/** The real conversations, channel send, holds and run notices over a fake chat store; the channel and the line store are doubles. */
const buildSpeaking = async () => {
    const chat = speakingChat()
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    wireHolds(engine, mutations)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ...chat.providers,
            AgentGraphConversationHoldsService,
            AgentGraphRunNoticesService,

            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn().mockReturnValue("hold on") }) },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: fakeTransaction(mockEntityManager()).em },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
            {
                provide: AgentWakeService,
                useValue: mock<AgentWakeService>({ write: jest.fn().mockResolvedValue("w") }),
            },
            {
                provide: AgentGraphsService,
                useValue: mock<AgentGraphsService>({
                    documentOf: jest.fn().mockResolvedValue({ nodes: [], rights: [], flow: KEEPING_CONSULT }),
                }),
            },
            {
                provide: AgentWorkflowRunsService,
                useValue: mock<AgentWorkflowRunsService>({ workflowKeyOfRun: jest.fn().mockResolvedValue("consult") }),
            },
            {
                provide: AgentGraphFreezeGateService,
                useValue: mock<AgentGraphFreezeGateService>({ stopped: jest.fn().mockResolvedValue(true) }),
            },
        ],
    }).compile()
    const index = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })
    jest.spyOn(moduleRef.get(GraphNodeRegistryService), "installed").mockReturnValue(index)
    const send = moduleRef.get(ChannelSendExecutorService)
    chat.wire(send)
    return {
        conversations: moduleRef.get(ChatConversationsService),
        send,
        holds: moduleRef.get(AgentGraphConversationHoldsService),
        notices: moduleRef.get(AgentGraphRunNoticesService),
        messages: chat.messages,
        delivery: chat.delivery,
    }
}

/** The world a spec runs in. */
type SpeakingWorld = Awaited<ReturnType<typeof buildSpeaking>>

/** A turn of the Sales consult in the customer's conversation. */
const salesTurn = (conversationId: string) => speakingTurnOf(KEEPER_ID, conversationId)

/** The consult open: the front door met the customer, handed the conversation to Sales, and Sales answered and kept it. */
const consultOpen = async (world: SpeakingWorld): Promise<string> => {
    const { conversation } = await world.conversations.meet({ ...SPEAKING_CUSTOMER, agentId: DOOR_ID })
    await world.conversations.meet({ ...SPEAKING_CUSTOMER, agentId: KEEPER_ID })
    const reply = { conversationId: conversation.id, text: "Chao chi" }
    await expect(
        world.send.execute(salesTurn(conversation.id), reply, { key: "r1", dedupeKey: null }),
    ).resolves.toMatchObject({
        kind: "message",
        id: "m-out",
    })
    const step = stepViewOf({ workspaceId: CHAT_WORKSPACE, agentId: KEEPER_ID, runId: "run-s1", nodeKey: "reply" })
    const input = { versionId: "v-1", nodeKey: "reply", trigger: { conversationId: conversation.id } }
    await expect(world.holds.keptAfter(step, input, conversation.id)).resolves.toBe(true)
    return conversation.id
}

/** The customer's next line: the front door meets them again, and that meeting gives the front door the right to speak. */
const nextLine = async (world: SpeakingWorld, conversationId: string) => {
    await world.conversations.meet({ ...SPEAKING_CUSTOMER, agentId: DOOR_ID })
    return agentTurnViewOf({
        workspaceId: CHAT_WORKSPACE,
        agentId: DOOR_ID,
        wakeId: "wake-2",
        eventKey: "msg-2",
        source: "customer",
        scopeKey: `conversation:${conversationId}`,
        context: { conversationId, messageId: "m-2" },
    })
}

describe("AgentGraphConversationHoldsService: the keeper keeps the right to speak", () => {
    it("gives the right to speak back to Sales with the line sent on, so Sales answers the customer's next line", async () => {
        const world = await buildSpeaking()
        const conversationId = await consultOpen(world)
        const line = await nextLine(world, conversationId)
        const reply = { conversationId, text: "Tang nguoi yeu thi chi chon hoa hong nhe" }
        await expect(
            world.send.execute(salesTurn(conversationId), reply, { key: "r2", dedupeKey: null }),
        ).resolves.toMatchObject({ kind: "refused", id: "not_speaking" })

        await expect(world.holds.redirected(line)).resolves.toBe(true)

        await expect(world.conversations.turnOf(CHAT_WORKSPACE, conversationId)).resolves.toMatchObject({
            value: { agent: { id: KEEPER_ID } },
        })
        await expect(
            world.send.execute(salesTurn(conversationId), reply, { key: "r2", dedupeKey: null }),
        ).resolves.toMatchObject({ kind: "message", id: "m-out" })
        expect(world.delivery.deliver).toHaveBeenCalledTimes(2)
    })

    it("sends the line the AI core chose for a stuck step as the agent that speaks now, so the line never fails on who speaks", async () => {
        const world = await buildSpeaking()
        const conversationId = await consultOpen(world)
        await nextLine(world, conversationId)
        const step = stepViewOf({ workspaceId: CHAT_WORKSPACE, agentId: KEEPER_ID, runId: "run-s2", stepKey: "reply" })
        const notice = {
            step,
            turn: salesTurn(conversationId),
            trigger: { conversationId, channel: "telegram" },
            code: "handler_threw",
        }

        await world.notices.stuck(notice, {
            report: { reason: "Em chua tao duoc don, anh xem giup", question: null, suggestions: [] },
            customerLine: "Da shop dang kiem tra, se bao chi ngay a",
            facts: [["code", "handler_threw"]],
            leadId: null,
        })

        expect(world.messages.storeAgentLine).toHaveBeenLastCalledWith(
            expect.objectContaining({
                conversationId,
                body: "Da shop dang kiem tra, se bao chi ngay a",
                sentBy: DOOR_ID,
            }),
        )
        expect(world.delivery.deliver).toHaveBeenCalledTimes(2)
    })

    it("says nothing to the customer when a run stops: the engine has no line of its own any more", async () => {
        const world = await buildSpeaking()
        const conversationId = await consultOpen(world)
        await nextLine(world, conversationId)
        const step = stepViewOf({ workspaceId: CHAT_WORKSPACE, agentId: KEEPER_ID, runId: "run-s2", stepKey: "reply" })

        await world.notices.runStopped({
            step,
            turn: salesTurn(conversationId),
            trigger: { conversationId, channel: "telegram" },
            code: "handler_threw",
        })

        // Only the consult's own first answer ever went out.
        expect(world.delivery.deliver).toHaveBeenCalledTimes(1)
    })

    it("gives the right to speak back to a frozen consult run when the owner retries it, with no new line from the customer", async () => {
        const world = await buildSpeaking()
        const conversationId = await consultOpen(world)
        await nextLine(world, conversationId)
        const reply = { conversationId, text: "Da, em ghi nhan dia chi a" }
        await expect(
            world.send.execute(salesTurn(conversationId), reply, { key: "r3", dedupeKey: null }),
        ).resolves.toMatchObject({ kind: "refused", id: "not_speaking" })

        const retried = stepViewOf({
            workspaceId: CHAT_WORKSPACE,
            agentId: KEEPER_ID,
            runId: "run-frozen",
            stepKey: "reply",
        })
        await world.holds.speakFor(
            retried,
            { versionId: "v-1", nodeKey: "reply", trigger: { conversationId } },
            SPEAKING_STEP,
        )

        await expect(world.conversations.turnOf(CHAT_WORKSPACE, conversationId)).resolves.toMatchObject({
            value: { agent: { id: KEEPER_ID } },
        })
        await expect(
            world.send.execute(salesTurn(conversationId), reply, { key: "r3", dedupeKey: null }),
        ).resolves.toMatchObject({ kind: "message", id: "m-out" })
    })

    it("leaves the right to speak where it is for a step that sends nothing, or when another agent keeps the conversation", async () => {
        const world = await buildSpeaking()
        const conversationId = await consultOpen(world)
        await nextLine(world, conversationId)
        const door = stepViewOf({ workspaceId: CHAT_WORKSPACE, agentId: DOOR_ID, runId: "run-door", stepKey: "reply" })

        await world.holds.speakFor(
            door,
            { versionId: "v-1", nodeKey: "reply", trigger: { conversationId } },
            SPEAKING_STEP,
        )
        await world.holds.speakFor(door, { versionId: "v-1", nodeKey: "reply", trigger: {} }, SPEAKING_STEP)

        const salesEnd = stepViewOf({
            workspaceId: CHAT_WORKSPACE,
            agentId: KEEPER_ID,
            runId: "run-s3",
            stepKey: "done",
        })
        await world.holds.speakFor(
            salesEnd,
            { versionId: "v-1", nodeKey: "done", trigger: { conversationId } },
            "core.outcome",
        )
        await expect(world.conversations.turnOf(CHAT_WORKSPACE, conversationId)).resolves.toMatchObject({
            value: { agent: { id: DOOR_ID } },
        })
    })
})
