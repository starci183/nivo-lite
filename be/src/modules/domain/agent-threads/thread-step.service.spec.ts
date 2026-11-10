import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeHostPorts } from "@nivo-lite/agent-sdk/node"
import { AgentGraphAiCoreService, AgentGraphsService, AgentWorkflowRunsService } from "@modules/domain/agent-graphs"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { GraphNodeHostService, GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor, NodeRunInput } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { DomainError } from "@modules/platform/errors"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ThreadNodeScope, ThreadState } from "@modules/integrations/langgraph"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import type { StopBuild } from "./stops/run-stop-records.service"
import type { RunStop, StopOpen } from "./stops/run-stop.contracts"
import { RunStopsService } from "./stops/run-stops.service"
import { StopCardsService } from "./stops/stop-cards.service"
import { workflowTemplateOf } from "@nivo-lite/blocks-core/modules"
import { FREEZE_NODE, type CompiledStep } from "./template-compiler.policy"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadStepService } from "./thread-step.service"
import type { ThreadStepNode } from "./thread-step.service"

const NOW = "2026-11-10T10:00:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-1" }

/** An error of another capability, as the AI layer and the engine throw them. */
class OtherError extends DomainError<string> {}

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: [] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [
        { key: "match", step: "accounting.match-payment", next: "settle" },
        { key: "settle", step: "payment.settle" },
    ],
} as unknown as GraphSpec

const STEP: CompiledStep = {
    key: "match",
    step: "accounting.match-payment",
    kind: "execute",
    exit: { kind: "next", to: "settle" },
    ends: ["settle", FREEZE_NODE],
} as unknown as CompiledStep

const replay = (ports: NodeHostPorts): NodeHostPorts => ports

const AT: ThreadStepNode = {
    agentId: "agent-1",
    versionId: "v-1",
    flow: FLOW,
    step: STEP,
    namespace: "accounting.reconcile",
    workflowId: "wf-1",
    replay,
}

/** A bank-fed run: no customer, no conversation. */
const stateOf = (over: Partial<ThreadState> = {}): ThreadState => ({
    trigger: { transactionId: "tx-1", subject: { kind: "bank-transaction", id: "tx-1" }, locale: "vi" },
    steps: {},
    trouble: null,
    founderAnswers: [],
    loop: null,
    ...over,
})

const scopeOf = (decision?: unknown): ThreadNodeScope => ({
    thread: REF,
    node: "match",
    version: "v-1",
    stop: jest.fn(() => {
        if (decision === undefined) throw new Error("interrupted")
        return decision
    }) as ThreadNodeScope["stop"],
})

/** What a spec changes of the world: a side node, the run's workflow name, the customer of the conversation. */
interface World {
    readonly blocking?: boolean
    readonly workflowName?: string
    readonly conversationLead?: string | null
}

const build = async (world: World = {}) => {
    let stop: RunStop | null = null
    const graphs = mock<AgentGraphsService>({
        runGrantOf: jest.fn().mockResolvedValue({ rights: [], tools: [], effects: null }),
    })
    const host = mock<GraphNodeHostService>()
    const post = mock<NodeEffectExecutor>({ effect: "team.message.post" })
    post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
    const definition = {
        effects: [],
        title: { vi: "Khớp tiền với đơn", en: "Match" },
        ...(world.blocking === undefined ? {} : { blocking: world.blocking }),
    }
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest.fn(() => ({ nodes: new Map([["accounting.match-payment", definition]]) }) as never),
        optionalExecutorOf: jest.fn((effect: string) => (effect === "team.message.post" ? post : undefined)),
    })
    const workflowRuns = mock<AgentWorkflowRunsService>({
        pinsOf: jest.fn().mockResolvedValue(
            world.workflowName === undefined ? [] : [{ runId: "run-1", workflowId: "wf-1", workflowName: world.workflowName, version: 1 }],
        ),
    })
    const conversations = mock<ChatConversationsService>({
        leadIdOf: jest.fn().mockResolvedValue(world.conversationLead ?? null),
        ofLeads: jest.fn().mockResolvedValue([]),
    })
    const core = mock<AgentGraphAiCoreService>()
    const projection = mock<ThreadProjectionService>()
    const records = mock<RunStopRecordsService>({
        open: jest.fn((input: StopOpen) => {
            stop = {
                id: "stop-1",
                version: "1",
                runId: input.runId,
                stepKey: input.stepKey,
                agentId: input.agentId,
                workflowId: input.workflowId,
                leadId: input.leadId,
                conversationId: input.conversationId,
                kind: input.kind,
                state: "open",
                reason: input.reason,
                question: input.question,
                detail: { suggestions: [...input.suggestions], facts: [...input.facts] },
                cardMessageId: null,
                customerLines: [],
                answers: stop?.answers ?? [],
                decision: null,
                repeats: (stop?.repeats ?? 0) + 1,
                stoppedAt: NOW,
                resolvedAt: null,
            }
            return Promise.resolve(stop)
        }),
        byRunStep: jest.fn(() => Promise.resolve(stop)),
        patch: jest.fn((_ws: string, _id: string, change: StopBuild) => {
            if (stop === null) return Promise.resolve(null)
            const values = change(stop)
            if (values === null) return Promise.resolve(null)
            stop = { ...stop, ...values }
            return Promise.resolve(stop)
        }),
    })
    const cards = mock<StopCardsService>({ posted: jest.fn().mockResolvedValue("msg-1"), resolved: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadStepService,
            RunStopsService,
            { provide: RunStopRecordsService, useValue: records },
            { provide: StopCardsService, useValue: cards },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeHostService, useValue: host },
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: AgentGraphAiCoreService, useValue: core },
            { provide: AgentWorkflowRunsService, useValue: workflowRuns },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ThreadProjectionService, useValue: projection },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
        ],
    }).compile()
    return { steps: moduleRef.get(ThreadStepService), graphs, host, core, records, cards, post, projection, stopOf: () => stop }
}

/** The run input the host was handed on its call. */
const hostInputOf = (host: ReturnType<typeof mock<GraphNodeHostService>>, call = 0): NodeRunInput | undefined =>
    host.run.mock.calls[call]?.[0]

describe("ThreadStepService.run: one step of a thread", () => {
    it("runs the node under the key <run>:<step> with the thread's replay ports, keeps its output and goes to the next node", async () => {
        const { steps, host, records } = await build()
        host.run.mockResolvedValue({ output: { orderId: "o-1" }, effects: [] })

        await expect(steps.run(AT, stateOf(), scopeOf())).resolves.toEqual({
            update: { steps: { match: { output: { orderId: "o-1" } } }, trouble: null },
            goto: "settle",
        })
        expect(hostInputOf(host)).toMatchObject({ nodeId: "accounting.match-payment", key: "run-1:match" })
        expect(hostInputOf(host)?.turn.founderAnswers).toBeUndefined()
        expect(records.open).not.toHaveBeenCalled()
    })

    it("hands the host the thread's replay with a record of its own loop's model turns, made for this run of the node", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: { orderId: "o-1" }, effects: [] })
        const ports = mock<NodeHostPorts>()

        await steps.run(AT, stateOf(), scopeOf())
        await steps.run(AT, stateOf(), scopeOf())

        const [first, second] = [hostInputOf(host, 0), hostInputOf(host, 1)]
        // The thread's own wrapper does the wrapping (outside a graph node it hands the ports back as they are).
        expect(first?.replay?.(ports)).toBe(ports)
        // Outside the run of a graph node nothing can be recorded: the turn asks the model, once.
        const act = jest.fn(() => Promise.resolve({ text: "", calls: [] }))
        await expect(first?.record?.("order.look:agent#1:abc", act)).resolves.toEqual({ text: "", calls: [] })
        expect(act).toHaveBeenCalledTimes(1)
        // A record belongs to one run of the node.
        expect(second?.record).not.toBe(first?.record)
    })

    it("hands a node that cannot complete to the AI core, and stops the step with the AI's words (a bank-fed run too)", async () => {
        const { steps, host, core, records, stopOf } = await build()
        host.run.mockRejectedValue(new OtherError({ code: "PAYMENT_REFUSED", params: { refusal: "order_closed" } }))
        core.decide.mockResolvedValue({
            kind: "report",
            reason: "Đơn đã đóng",
            question: "Hoàn hay giữ?",
            suggestions: [{ text: "Giữ lại", handledBy: "person" }],
            customerLine: null,
        })

        const answer = await steps.run(AT, stateOf(), scopeOf())

        expect(core.decide).toHaveBeenCalledWith(expect.objectContaining({ nodeKey: "match", nodeStep: "accounting.match-payment" }))
        expect(records.open).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "ai_report", reason: "Đơn đã đóng", leadId: null, conversationId: null }),
            NOW,
        )
        expect(answer).toEqual({
            update: {
                trouble: {
                    stepKey: "match",
                    question: expect.objectContaining({ stopId: "stop-1", kind: "ai_report", question: "Hoàn hay giữ?" }),
                    locale: "vi",
                },
            },
            goto: FREEZE_NODE,
        })
        expect(stopOf()?.detail.facts).toEqual(expect.arrayContaining([{ name: "code", value: "order_closed" }]))
    })

    it("sends a failure BEFORE the node runs (the grant) through the AI core too: an AI report, never a silent engine error", async () => {
        const { steps, graphs, host, core, records } = await build()
        graphs.runGrantOf.mockRejectedValue(new OtherError({ code: "ENTITY_ENGINE_QUERY_INVALID", params: {} }))
        core.decide.mockResolvedValue({ kind: "report", reason: "Không đọc được quyền", question: null, suggestions: [], customerLine: null })

        await expect(steps.run(AT, stateOf(), scopeOf())).resolves.toMatchObject({ goto: FREEZE_NODE })

        expect(host.run).not.toHaveBeenCalled()
        expect(core.decide).toHaveBeenCalledWith(
            expect.objectContaining({ trouble: expect.objectContaining({ code: "ENTITY_ENGINE_QUERY_INVALID" }) }),
        )
        expect(records.open).toHaveBeenCalledWith(expect.objectContaining({ kind: "ai_report" }), NOW)
    })

    it("speaks for itself only when the AI could not be reached: the engine's words and the tries, the AI core not asked", async () => {
        const { steps, host, core, records, stopOf } = await build()
        host.run.mockRejectedValue(
            new OtherError({ code: "AI_TASKS_UNAVAILABLE", params: { tries: 3, failures: "timeout, timeout, empty" } }),
        )

        await expect(steps.run(AT, stateOf(), scopeOf())).resolves.toMatchObject({ goto: FREEZE_NODE })

        expect(core.decide).not.toHaveBeenCalled()
        expect(records.open).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "ai_error", reason: "[agentGraphs.stuck.aiFailed]", suggestions: [] }),
            NOW,
        )
        expect(stopOf()?.detail.facts).toEqual(
            expect.arrayContaining([
                { name: "tries", value: "3" },
                { name: "failures", value: "timeout, timeout, empty" },
            ]),
        )
    })
})

describe("ThreadStepService.run: a step whose outcome is unknown is never completed or re-run by a machine", () => {
    it.each(["tool_outcome_unknown", "delivery_outcome_unknown", "decision_actor_unknown"])(
        "%s stops for the founder even when the AI core offers an output",
        async (code) => {
            const { steps, host, core, records } = await build()
            host.run.mockRejectedValue(new OtherError({ code, params: {} }))
            core.decide.mockResolvedValue({ kind: "output", output: { orderId: "o-1" } })

            const answer = await steps.run(AT, stateOf(), scopeOf())

            expect(answer.goto).toBe(FREEZE_NODE)
            expect(answer.update?.steps).toBeUndefined()
            expect(records.open).toHaveBeenCalledWith(
                expect.objectContaining({ kind: "ai_error", reason: "[agentGraphs.stuck.engine]" }),
                NOW,
            )
            expect(host.run).toHaveBeenCalledTimes(1)
        },
    )
})

describe("ThreadStepService.run: a side node (blocking: false) that fails", () => {
    it("is passed over: the thread goes to its exit and the founder gets one ordinary notice, keyed per run and step", async () => {
        const { steps, host, core, records, post } = await build({ blocking: false, workflowName: "Đối soát của tiệm" })
        host.run.mockRejectedValue(new OtherError({ code: "PAYMENT_REFUSED", params: {} }))

        const answer = await steps.run(AT, stateOf(), scopeOf())

        expect(answer).toEqual({
            update: { steps: { match: { output: null, effects: [], failed: "PAYMENT_REFUSED", passedOver: true } }, trouble: null },
            goto: "settle",
        })
        expect(core.decide).not.toHaveBeenCalled()
        expect(records.open).not.toHaveBeenCalled()
        const [, payload, call] = post.execute.mock.calls[0] ?? []
        expect(call).toEqual({ key: "side-passed:run-1:match", dedupeKey: "side-passed:run-1:match" })
        expect(payload).toMatchObject({ kind: "message.text", intent: "notify", audience: "founder" })
        expect(String(Reflect.get(payload ?? {}, "text"))).toContain("Đối soát của tiệm")
        expect(String(Reflect.get(payload ?? {}, "text"))).toContain("PAYMENT_REFUSED")
    })

    it("still stops for the founder when its outcome is unknown", async () => {
        const { steps, host, records, post } = await build({ blocking: false })
        host.run.mockRejectedValue(new OtherError({ code: "delivery_outcome_unknown", params: {} }))

        await expect(steps.run(AT, stateOf(), scopeOf())).resolves.toMatchObject({ goto: FREEZE_NODE })
        expect(records.open).toHaveBeenCalledTimes(1)
        expect(post.execute).not.toHaveBeenCalled()
    })
})

describe("ThreadStepService.run: the stop names the workflow, the step and the customer", () => {
    it("names the workflow by its stored name, the step by its node title, and the customer of the conversation", async () => {
        const { steps, host, core, records } = await build({ workflowName: "Đối soát của tiệm", conversationLead: "lead-7" })
        host.run.mockRejectedValue(new OtherError({ code: "PAYMENT_REFUSED", params: {} }))
        core.decide.mockResolvedValue({ kind: "report", reason: "x", question: null, suggestions: [], customerLine: null })
        const consult = stateOf({ trigger: { conversationId: "conv-1", locale: "vi" } })

        await steps.run(AT, consult, scopeOf())

        expect(records.open).toHaveBeenCalledWith(
            expect.objectContaining({
                leadId: "lead-7",
                conversationId: "conv-1",
                card: expect.objectContaining({
                    workflow: { moduleKey: "accounting", key: "reconcile", title: "Đối soát của tiệm" },
                    step: { key: "match", nodeId: "accounting.match-payment", title: "Khớp tiền với đơn" },
                }),
            }),
            NOW,
        )
    })

    it("falls back to the name of the NIVO template the workflow was made from", async () => {
        const { steps, host, core, records } = await build()
        host.run.mockRejectedValue(new OtherError({ code: "PAYMENT_REFUSED", params: {} }))
        core.decide.mockResolvedValue({ kind: "report", reason: "x", question: null, suggestions: [], customerLine: null })

        await steps.run(AT, stateOf(), scopeOf())

        const opened = records.open.mock.calls[0]?.[0]
        expect(opened?.card.workflow.title).toBe(workflowTemplateOf("accounting.reconcile")?.name.vi)
    })
})

describe("ThreadStepService.gate and the founder's decisions", () => {
    /** Stops the step once, so the gate has a stop to route. */
    const stopped = async (built: Awaited<ReturnType<typeof build>>) => {
        built.host.run.mockRejectedValueOnce(new OtherError({ code: "PAYMENT_REFUSED", params: {} }))
        built.core.decide.mockResolvedValue({ kind: "report", reason: "Chưa rõ", question: "Của đơn nào?", suggestions: [], customerLine: null })
        const answer = await built.steps.run(AT, stateOf(), scopeOf())
        return stateOf({ trouble: answer.update?.trouble })
    }

    it("hands the stop's question to scope.stop and waits there", async () => {
        const built = await build()
        const state = await stopped(built)
        const scope = scopeOf()

        await expect(built.steps.gate({ agentId: "agent-1" }, state, scope)).rejects.toThrow("interrupted")
        expect(scope.stop).toHaveBeenCalledWith(expect.objectContaining({ stepKey: "match", question: "Của đơn nào?" }))
    })

    it("an answer re-runs the step with the founder's words on its turn, and the step then completes the stop", async () => {
        const built = await build()
        const state = await stopped(built)
        const decision = { kind: "answer", text: "Của đơn SO-0003", by: "owner-1", at: "2026-11-10T10:05:00.000Z" }

        const routed = await built.steps.gate({ agentId: "agent-1" }, state, scopeOf(decision))

        expect(routed).toEqual({
            update: { founderAnswers: [{ text: "Của đơn SO-0003", at: "2026-11-10T10:05:00.000Z" }], trouble: null },
            goto: "match",
        })
        built.host.run.mockResolvedValue({ output: { orderId: "o-3" }, effects: [] })
        const rerun = stateOf({ founderAnswers: routed.update?.founderAnswers ?? [] })
        await expect(built.steps.run(AT, rerun, scopeOf())).resolves.toMatchObject({ goto: "settle" })
        expect(hostInputOf(built.host, 1)?.turn.founderAnswers).toEqual([{ text: "Của đơn SO-0003", at: "2026-11-10T10:05:00.000Z" }])
        expect(hostInputOf(built.host, 1)?.key).toBe("run-1:match")
        expect(built.stopOf()?.state).toBe("resolved")
    })

    it("a retry re-runs the step with no words added", async () => {
        const built = await build()
        const state = await stopped(built)

        const routed = await built.steps.gate({ agentId: "agent-1" }, state, scopeOf({ kind: "retry", by: "owner-1", at: "t" }))

        expect(routed).toEqual({ update: { founderAnswers: [], trouble: null }, goto: "match" })
    })

    it("a skip ends the run and resolves the stop", async () => {
        const built = await build()
        const state = await stopped(built)

        const routed = await built.steps.gate({ agentId: "agent-1" }, state, scopeOf({ kind: "skip", by: "owner-1", at: "t" }))

        expect(routed.goto).toBe("__end__")
        expect(built.stopOf()?.state).toBe("resolved")
        expect(built.projection.runEnded).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ outcome: "skipped", by: "owner-1" }),
        )
    })

    it("a gate run again with the same decision after a crash keeps the founder's words once and routes the same way", async () => {
        const built = await build()
        const state = await stopped(built)
        const decision = { kind: "answer", text: "Của đơn SO-0003", by: "owner-1", at: "2026-11-10T10:05:00.000Z" }

        const first = await built.steps.gate({ agentId: "agent-1" }, state, scopeOf(decision))
        const replayed = await built.steps.gate({ agentId: "agent-1" }, state, scopeOf(decision))

        expect(replayed).toEqual(first)
        expect(built.stopOf()?.answers).toHaveLength(1)
    })

    it("a skip replayed after the stop resolved routes to the end again instead of refusing", async () => {
        const built = await build()
        const state = await stopped(built)
        const skip = { kind: "skip", by: "owner-1", at: "t" }

        await built.steps.gate({ agentId: "agent-1" }, state, scopeOf(skip))
        const replayed = await built.steps.gate({ agentId: "agent-1" }, state, scopeOf(skip))

        expect(replayed.goto).toBe("__end__")
        expect(built.stopOf()?.answers).toHaveLength(1)
    })

    it("a take-over keeps the thread at the gate and the run waiting as taken over, never running", async () => {
        const built = await build()
        const state = await stopped(built)

        const routed = await built.steps.gate({ agentId: "agent-1" }, state, scopeOf({ kind: "take_over", by: "owner-1", at: "t" }))

        expect(routed.goto).toBe(FREEZE_NODE)
        expect(built.projection.takenOver).toHaveBeenCalledWith({ workspaceId: "ws-1", runId: "run-1" }, "owner-1")
        expect(built.projection.resumed).not.toHaveBeenCalled()
        expect(built.stopOf()?.state).toBe("open")
    })
})
