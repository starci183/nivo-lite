import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL, workflowStoppedPayload } from "@nivo-lite/blocks-core"
import { workflowTemplateOf } from "@nivo-lite/blocks-core/modules"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import type { StepView } from "@modules/domain/agent-runs"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphRunNoticesService } from "./agent-graph-run-notices.service"
import type { RunNotice, StuckTold } from "./agent-graph-run-notices.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphFreezeGateService } from "./agent-graph-freeze-gate.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentRunsService, AgentRunsViewService } from "@modules/domain/agent-runs"

const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "c-1",
    locale: "vi",
    origin: "system",
    memberId: null,
    handedOffBy: "front-1",
}

const CHAT = { conversationId: "c-1", channel: "zalo" }

const stepOf = (earlier: StepView["earlier"] = {}): StepView =>
    stepViewOf({ stepKey: "notify", nodeKey: "notify", kind: "graph_node", earlier })

const noticeOf = (over: Partial<RunNotice> = {}): RunNotice => ({
    step: stepOf(),
    turn: TURN,
    trigger: CHAT,
    code: "handler_threw",
    ...over,
})

/** How the freezes answer a stopped run: not asked (no freezes kept), took it, or threw. */
type Freezes = "none" | "frozen" | "threw"

type TurnOf = Extract<Awaited<ReturnType<ChatConversationsService["turnOf"]>>, { kind: "ok" }>["value"]

const build = async (
    executors: { readonly raise?: boolean; readonly send?: boolean; readonly post?: boolean } = {},
    freezes: Freezes = "none",
    workflowName?: string,
    runs?: { readonly agentRuns: AgentRunsService; readonly views: AgentRunsViewService },
) => {
    const gate = mock<AgentGraphFreezeGateService>({
        stopped: jest.fn(() =>
            freezes === "threw" ? Promise.reject(new Error("db down")) : Promise.resolve(freezes === "frozen"),
        ),
    })
    const raise = mock<NodeEffectExecutor>({ effect: TOOL.workItemRaise })
    raise.execute.mockResolvedValue({ kind: "work-item", id: "w-1" })
    const send = mock<NodeEffectExecutor>({ effect: TOOL.customerMessageSend })
    send.execute.mockResolvedValue({ kind: "message", id: "m-1" })
    const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
    post.execute.mockResolvedValue({ kind: "chat-message", id: "t-1" })
    const executorOf = (effect: string): NodeEffectExecutor | undefined => {
        if (effect === TOOL.workItemRaise) return executors.raise === false ? undefined : raise
        if (effect === TOOL.teamMessagePost) return executors.post === false ? undefined : post
        return effect === TOOL.customerMessageSend && executors.send !== false ? send : undefined
    }
    const conversations = mock<ChatConversationsService>()
    conversations.ofLeads.mockResolvedValue([
        mock<Awaited<ReturnType<ChatConversationsService["ofLeads"]>>[number]>({ id: "c-9", leadId: "lead-1" }),
    ])
    conversations.leadIdOf.mockResolvedValue(null)
    conversations.turnOf.mockResolvedValue({
        kind: "ok",
        value: mock<TurnOf>({ agent: mock<TurnOf["agent"]>({ id: "speaker-1" }) }),
    })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphRunNoticesService,
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({
                    optionalExecutorOf: jest.fn(executorOf),
                    installed: jest.fn(() => ({ nodes: new Map([["payment.settle", { title: SETTLE_TITLE }]]) }) as never),
                }),
            },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: mock<Clock>({ now: jest.fn(() => new Date("2026-11-10T08:00:00.000Z")) }) },
            ...(freezes === "none" ? [] : [{ provide: AgentGraphFreezeGateService, useValue: gate }]),
            { provide: ChatConversationsService, useValue: conversations },
            ...(runs === undefined
                ? []
                : [
                      { provide: AgentRunsService, useValue: runs.agentRuns },
                      { provide: AgentRunsViewService, useValue: runs.views },
                  ]),
            ...(workflowName === undefined
                ? []
                : [
                      {
                          provide: AgentWorkflowRunsService,
                          useValue: mock<AgentWorkflowRunsService>({
                              pinsOf: jest.fn().mockResolvedValue([
                                  { runId: "run-1", workflowId: "wf-1", workflowName, version: 1 },
                              ]),
                          }),
                      },
                  ]),
        ],
    }).compile()
    return { notices: moduleRef.get(AgentGraphRunNoticesService), raise, send, post, logger, gate, conversations }
}

const FACTS: StuckTold["facts"] = [
    ["workflow", "accounting.reconcile"],
    ["step", "settle (payment.settle)"],
    ["code", "payment_refused"],
    ["run", "run-1"],
]

const REPORT = {
    reason: "Khách chuyển 2.000đ cho đơn 1.000đ.",
    question: "Anh/chị muốn xử lý khoản dư thế nào?",
    suggestions: [
        { text: "Nhận cả khoản và ghi sổ", handledBy: "workflow" as const },
        { text: "Hoàn lại 1.000đ cho khách", handledBy: "person" as const },
    ],
}

const toldOf = (over: Partial<StuckTold> = {}): StuckTold => ({
    report: REPORT,
    customerLine: null,
    facts: FACTS,
    leadId: "lead-1",
    ...over,
})

const NOW = "2026-11-10T08:00:00.000Z"

const WORKFLOW = { moduleKey: "accounting", key: "reconcile", title: "reconcile" }

/** The title of the settle node as the registry holds it. */
const SETTLE_TITLE = { vi: "Đánh dấu đã trả", en: "Mark paid" }

/** The name of the NIVO template the reconcile workflow is made from, in Vietnamese. */
const RECONCILE_NAME = workflowTemplateOf("accounting.reconcile")?.name.vi ?? ""

const FACT_LINES =
    "- workflow: accounting.reconcile\n- step: settle (payment.settle)\n- code: payment_refused\n- run: run-1"

describe("AgentGraphRunNoticesService a stuck step", () => {
    it("tells the team with the one common card in the AI core's own words, the engine's facts as named values, and the suggestions as the card's reply options", async () => {
        const { notices, post, send } = await build()

        await notices.stuck(noticeOf({ workflow: WORKFLOW, nodeId: "payment.settle", leadId: "lead-1" }), toldOf())

        expect(post.execute).toHaveBeenCalledTimes(1)
        const [turn, payload, call] = post.execute.mock.calls[0] ?? []
        expect(turn).toBe(TURN)
        expect(call).toEqual({ key: "run-stuck:run-1:notify:0:1", dedupeKey: "run-stuck:run-1:notify" })
        expect(payload).toMatchObject({ kind: "workflow.stopped", title: "[agentGraphs.stuck.title]" })
        const card = workflowStoppedPayload.parse(Reflect.get(payload ?? {}, "card"))
        expect(RECONCILE_NAME).not.toBe("")
        expect(card).toEqual({
            workflow: { ...WORKFLOW, title: RECONCILE_NAME },
            step: { key: "notify", nodeId: "payment.settle", title: SETTLE_TITLE.vi },
            runId: "run-1",
            leadId: "lead-1",
            conversationId: "c-1",
            by: "ai",
            reason: REPORT.reason,
            question: REPORT.question,
            facts: FACTS.map(([name, value]) => ({ name, value })),
            suggestions: REPORT.suggestions,
            decisions: [],
            repeats: 1,
            firstAt: NOW,
            lastAt: NOW,
        })
        expect(Reflect.get(payload ?? {}, "summary")).toBe(`${REPORT.reason}\n${REPORT.question}\n${FACT_LINES}`)
        expect(send.execute).not.toHaveBeenCalled()
    })

    it("names the workflow by its own name when the run's pin has one, and a step no installed node is by its key", async () => {
        const { notices, post } = await build({}, "none", "Đối soát của tiệm")

        await notices.stuck(noticeOf({ workflow: WORKFLOW, nodeId: "mystery.node" }), toldOf())

        const card = workflowStoppedPayload.parse(Reflect.get(post.execute.mock.calls[0]?.[1] ?? {}, "card"))
        expect(card.workflow).toEqual({ ...WORKFLOW, title: "Đối soát của tiệm" })
        expect(card.step).toEqual({ key: "notify", nodeId: "mystery.node", title: "notify" })
    })

    it("names the customer of the run's conversation on the card when the run itself names none yet", async () => {
        const { notices, post, conversations } = await build()
        conversations.leadIdOf.mockResolvedValue("lead-7")

        await notices.stuck(noticeOf({ workflow: WORKFLOW, nodeId: "payment.settle" }), toldOf())

        const card = workflowStoppedPayload.parse(Reflect.get(post.execute.mock.calls[0]?.[1] ?? {}, "card"))
        expect(card.leadId).toBe("lead-7")
        expect(conversations.leadIdOf).toHaveBeenCalledWith("ws-1", "c-1")
    })

    it("marks the card of every step of a run that then ended well as resolved, in place, under each step's key", async () => {
        const agentRuns = mock<AgentRunsService>({
            runOf: jest.fn().mockResolvedValue({ id: "run-1", agentId: "agent-1", context: { locale: "vi" } }),
        })
        const views = mock<AgentRunsViewService>({
            detail: jest.fn().mockResolvedValue({ run: {}, steps: [{ stepKey: "match" }, { stepKey: "settle" }] }),
        })
        const { notices, post } = await build({}, "none", undefined, { agentRuns, views })

        await notices.runResolved("ws-1", "run-1")

        expect(post.execute.mock.calls.map(([, , call]) => call)).toEqual([
            { key: "run-stuck:run-1:match:resolved", dedupeKey: "run-stuck:run-1:match" },
            { key: "run-stuck:run-1:settle:resolved", dedupeKey: "run-stuck:run-1:settle" },
        ])
        expect(post.execute.mock.calls[0]?.[1]).toEqual({
            kind: "workflow.stopped",
            resolved: {
                title: "[agentGraphs.stuck.resolvedTitle]",
                summary: "[agentGraphs.stuck.resolvedSummary]",
                at: NOW,
            },
        })
    })

    it("speaks for itself only when the AI failed: static words, the same facts, no suggestions, the three freeze decisions, never a line to the customer", async () => {
        const { notices, post, send } = await build()

        await notices.stuck(noticeOf(), toldOf({ report: null, customerLine: null }))

        const card = workflowStoppedPayload.parse(Reflect.get(post.execute.mock.calls[0]?.[1] ?? {}, "card"))
        expect(card).toMatchObject({
            by: "engine",
            reason: "[agentGraphs.stuck.aiFailed]",
            question: null,
            suggestions: [],
            decisions: ["retry", "take_over", "skip"],
            facts: FACTS.map(([name, value]) => ({ name, value })),
        })
        expect(send.execute).not.toHaveBeenCalled()
    })

    it("names the stop of the step by the answers already given and the try, so a later stop of the same step folds and a replay does not", async () => {
        const { notices, post } = await build()
        const answered = { ...CHAT, founderAnswers: [{ text: "ok", at: "2026-11-10T07:00:00.000Z" }] }

        await notices.stuck(noticeOf({ trigger: answered }), toldOf())

        expect(post.execute.mock.calls[0]?.[2]).toEqual({
            key: "run-stuck:run-1:notify:1:1",
            dedupeKey: "run-stuck:run-1:notify",
        })
    })

    it("sends the customer only the line the AI core chose, as the agent that speaks in their conversation, under the holding-line key", async () => {
        const { notices, send } = await build()

        await notices.stuck(
            noticeOf(),
            toldOf({ customerLine: "Dạ shop đang kiểm tra lại giao dịch, sẽ báo bạn ngay ạ." }),
        )

        expect(send.execute).toHaveBeenCalledTimes(1)
        expect(send.execute).toHaveBeenCalledWith(
            { ...TURN, agentId: "speaker-1" },
            { conversationId: "c-1", text: "Dạ shop đang kiểm tra lại giao dịch, sẽ báo bạn ngay ạ." },
            { key: "honest-line:run-1:notify", dedupeKey: "honest-line:run-1:notify" },
        )
    })

    it("finds the customer's newest conversation for a run that serves none (money that arrived from the bank)", async () => {
        const { notices, send, conversations } = await build()

        await notices.stuck(
            noticeOf({ turn: { ...TURN, conversationId: null } }),
            toldOf({ customerLine: "Dạ shop đang kiểm tra ạ." }),
        )

        expect(conversations.ofLeads).toHaveBeenCalledWith("ws-1", ["lead-1"])
        expect(send.execute).toHaveBeenCalledWith(
            expect.objectContaining({ conversationId: "c-9", agentId: "speaker-1" }),
            { conversationId: "c-9", text: "Dạ shop đang kiểm tra ạ." },
            expect.anything(),
        )
    })

    it("logs a line the channel refuses or nobody can receive, and never throws: the team already knows", async () => {
        const refused = await build()
        refused.send.execute.mockRejectedValueOnce(new Error("window closed"))
        await expect(refused.notices.stuck(noticeOf(), toldOf({ customerLine: "x" }))).resolves.toBeUndefined()
        expect(refused.logger.warn).toHaveBeenCalledWith(AgentGraphsLogEvent.StuckLineSkipped, {
            runId: "run-1",
            code: "send_threw",
        })

        const nobody = await build()
        await nobody.notices.stuck(
            noticeOf({ turn: { ...TURN, conversationId: null } }),
            toldOf({ customerLine: "x", leadId: null }),
        )
        expect(nobody.send.execute).not.toHaveBeenCalled()
        expect(nobody.post.execute).toHaveBeenCalledTimes(1)
    })

    it("keeps the raw cause of a troubled step for developers, and records a step the AI core recovered", async () => {
        const { notices, logger } = await build()
        const trouble = {
            kind: "threw" as const,
            code: "handler_threw",
            text: "TypeError: claim.names is not iterable",
            data: {},
        }

        notices.troubled(stepOf(), trouble)
        notices.recovered(stepOf(), trouble)

        expect(logger.warn).toHaveBeenCalledWith(AgentGraphsLogEvent.StepTroubled, {
            runId: "run-1",
            stepKey: "notify",
            kind: "threw",
            code: "handler_threw",
            cause: "TypeError: claim.names is not iterable",
        })
        expect(logger.info).toHaveBeenCalledWith(AgentGraphsLogEvent.StepRecovered, {
            runId: "run-1",
            stepKey: "notify",
            code: "handler_threw",
        })
    })
})

describe("AgentGraphRunNoticesService a stopped run", () => {
    it("raises one owner review per run where no freeze takes it, and tells the team chat with the facts, never the customer", async () => {
        const { notices, raise, post, send } = await build()

        await notices.runStopped(noticeOf())

        expect(raise.execute).toHaveBeenCalledWith(
            TURN,
            {
                action: "review_agent_run",
                title: "[agentGraphs.runDead.title]",
                payload: { runId: "run-1", nodeKey: "notify", code: "handler_threw", conversationId: "c-1" },
            },
            { key: "graph-run-dead:run-1", dedupeKey: "graph-run-dead:run-1" },
        )
        const card = workflowStoppedPayload.parse(Reflect.get(post.execute.mock.calls[0]?.[1] ?? {}, "card"))
        expect(card).toMatchObject({
            by: "engine",
            reason: "[agentGraphs.stuck.engine]",
            decisions: [],
            facts: [
                { name: "step", value: "notify" },
                { name: "code", value: "handler_threw" },
                { name: "run", value: "run-1" },
            ],
        })
        expect(post.execute.mock.calls[0]?.[2]).toMatchObject({ dedupeKey: "run-stuck:run-1:notify" })
        expect(send.execute).not.toHaveBeenCalled()
    })

    it("stays quiet where nothing can raise or post", async () => {
        const quiet = await build({ raise: false, send: false, post: false })
        await expect(quiet.notices.runStopped(noticeOf())).resolves.toBeUndefined()
    })
})

describe("AgentGraphRunNoticesService a side step passed over", () => {
    it("tells the owner once per step with a review item that has nothing to resume, and never the customer", async () => {
        const { notices, raise, send } = await build()

        await notices.sidePassedOver(noticeOf())

        expect(raise.execute).toHaveBeenCalledWith(
            TURN,
            {
                action: "review_side_step",
                title: "[agentGraphs.sideStepFailed.title]",
                payload: { runId: "run-1", nodeKey: "notify", code: "handler_threw", conversationId: "c-1" },
            },
            { key: "graph-side-step:run-1:notify", dedupeKey: "graph-side-step:run-1:notify" },
        )
        expect(send.execute).not.toHaveBeenCalled()
    })
})

describe("AgentGraphRunNoticesService a stopped run that froze its customer", () => {
    it("raises no review of its own (the freeze holds the one item), still tells the team chat, and writes nothing to the customer", async () => {
        const { notices, raise, send, post, gate } = await build({}, "frozen")

        await notices.runStopped(noticeOf())

        expect(gate.stopped).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            runId: "run-1",
            code: "handler_threw",
            stepKey: "notify",
            trigger: CHAT,
        })
        expect(raise.execute).not.toHaveBeenCalled()
        expect(post.execute).toHaveBeenCalledTimes(1)
        expect(Reflect.get(post.execute.mock.calls[0]?.[1] ?? {}, "card")).toMatchObject({
            by: "engine",
            decisions: ["retry", "take_over", "skip"],
        })
        expect(send.execute).not.toHaveBeenCalled()
    })

    it("raises the run's own review when the freeze could not be recorded, so the run is never silent", async () => {
        const { notices, raise, logger } = await build({}, "threw")

        await notices.runStopped(noticeOf())

        expect(raise.execute).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.FreezeFailed, expect.any(Error), {
            runId: "run-1",
        })
    })
})
