import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeHostPorts } from "@nivo-lite/agent-sdk/node"
import { AgentGraphAiCoreService, AgentGraphsService, AgentWorkflowRunsService } from "@modules/domain/agent-graphs"
import { ConversationContactsService } from "@modules/domain/contacts"
import { CustomerRoutesService } from "@modules/domain/customer-routes"
import { THREAD_END } from "@modules/integrations/langgraph"
import { GraphNodeHostService, GraphNodeRegistryService, GraphNodesError, GraphNodesErrorCode } from "@modules/domain/graph-nodes"
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
import { ThreadApprovalsService } from "./thread-approvals.service"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { FREEZE_NODE, type CompiledStep } from "./template-compiler.policy"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadStepService } from "./thread-step.service"
import {
    KEEP_IT_VI,
    MATCH_STEP_TITLE_VI,
    OF_ORDER_SO3_VI,
    ORDER_CLOSED_REASON_VI,
    REFUND_OR_KEEP_VI,
    RIGHTS_UNREAD_REASON_VI,
    SHOP_RECONCILE_TITLE_VI,
    UNCLEAR_REASON_VI,
    WHICH_ORDER_QUESTION_VI,
} from "@tests/fixtures/i18n/agent-threads-spec.messages"
import type { ThreadStepNode } from "./thread-step.service"

const NOW = "2026-11-10T10:00:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-1" }

/** An error of another capability, as the AI layer and the engine throw them. */
class OtherError extends DomainError<string> {}

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: [] },
    grant: { tools: [], effects: [] },
    nodes: [
        { key: "match", kind: "execute", step: "accounting.match-payment", next: "settle" },
        { key: "settle", kind: "execute", step: "payment.settle" },
    ],
}

const STEP: CompiledStep = {
    key: "match",
    step: "accounting.match-payment",
    kind: "execute",
    exit: { kind: "next", to: "settle" },
    ends: ["settle", FREEZE_NODE],
}

const replay = (ports: NodeHostPorts): NodeHostPorts => ports

const AT: ThreadStepNode = {
    agentId: "agent-1",
    versionId: "v-1",
    flow: FLOW,
    step: STEP,
    namespace: "sales.consult",
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
    /** The approvals of `ask` calls (package 1-3); absent, an ask stays the step's trouble. */
    readonly approvals?: ThreadApprovalsService
    /** The member of the shop holding the route `conv-1` (the staff hold, R43/R45); absent, nobody holds it. */
    readonly heldBy?: string
}

/** The stop records of one run, kept in memory: one stop, opened again on every stop of the step. */
const stopRecordsOf = () => {
    let stop: RunStop | null = null
    const records = mock<RunStopRecordsService>({
        open: jest.fn((input: StopOpen) => {
            stop = {
                id: "stop-1",
                version: "1",
                runId: input.runId,
                stepKey: input.stepKey,
                agentId: input.agentId,
                workflowId: input.workflowId,
                contactId: input.contactId,
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
    return { records, stopOf: () => stop }
}

const build = async (world: World = {}) => {
    const { records, stopOf } = stopRecordsOf()
    const graphs = mock<AgentGraphsService>({
        runGrantOf: jest.fn().mockResolvedValue({ tools: [], effects: null }),
        // A pin that is already a workflow version is named by itself (the worlds below pin `v-1`).
        workflowVersionIdOf: jest.fn((_workspaceId: string, _agentId: string, versionId: string) => Promise.resolve(versionId)),
    })
    const host = mock<GraphNodeHostService>()
    const post = mock<NodeEffectExecutor>({ effect: "nivo.tool.team.message.post" })
    post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
    // The customer send, which the engine's own holding line of a stop goes through.
    const send = mock<NodeEffectExecutor>({ effect: "nivo.tool.customer.message.send" })
    send.execute.mockResolvedValue({ kind: "message", id: "line-1" })
    const definition = {
        effects: [],
        title: { vi: MATCH_STEP_TITLE_VI, en: "Match" },
        ...(world.blocking === undefined ? {} : { blocking: world.blocking }),
    }
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest.fn(() => ({ nodes: new Map([["accounting.match-payment", definition]]) }) as never),
        optionalExecutorOf: jest.fn((effect: string) => {
            if (effect === "nivo.tool.team.message.post") return post
            return effect === "nivo.tool.customer.message.send" ? send : undefined
        }),
    })
    const workflowRuns = mock<AgentWorkflowRunsService>({
        pinsOf: jest.fn().mockResolvedValue(
            world.workflowName === undefined ? [] : [{ runId: "run-1", workflowId: "wf-1", workflowName: world.workflowName, version: 1 }],
        ),
    })
    const contacts = mock<ConversationContactsService>({
        contactOf: jest.fn().mockResolvedValue(world.conversationLead ?? null),
    })
    const core = mock<AgentGraphAiCoreService>()
    const projection = mock<ThreadProjectionService>()
    const routes = mock<CustomerRoutesService>({
        holdOf: jest.fn((_ws: string, routeId: string) =>
            Promise.resolve(world.heldBy !== undefined && routeId === "conv-1" ? { memberId: world.heldBy, at: "2026-11-14T06:00:00.000Z" } : null),
        ),
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
            { provide: ConversationContactsService, useValue: contacts },
            { provide: ThreadProjectionService, useValue: projection },
            { provide: CustomerRoutesService, useValue: routes },
            ...(world.approvals === undefined ? [] : [{ provide: ThreadApprovalsService, useValue: world.approvals }]),
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
        ],
    }).compile()
    return { steps: moduleRef.get(ThreadStepService), graphs, host, core, records, cards, post, send, projection, stopOf }
}

/** The run input the host was handed on its call. */
const hostInputOf = (host: ReturnType<typeof mock<GraphNodeHostService>>, call = 0): NodeRunInput | undefined =>
    host.run.mock.calls[call]?.[0]

describe("ThreadStepService.run: the part a run plays for the provider trigger that started it", () => {
    const fired = (role: unknown) =>
        stateOf({ trigger: { transactionId: "tx-1", locale: "vi", providerTrigger: "sepay:transaction.received", connectionId: "mb", role } })

    it.each([["notice"], ["decider"]])("names `%s` on the workflow step of a run a provider trigger started", async (role) => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: {}, effects: [] })

        await steps.run(AT, fired(role), scopeOf())

        expect(hostInputOf(host)?.step).toEqual({ nodeKey: "match", versionId: "v-1", workflowId: "wf-1", triggerRole: role })
    })

    it("names no part for a run no provider trigger started (a `role` member alone is not one) nor for any other value", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: {}, effects: [] })

        await steps.run(AT, stateOf({ trigger: { transactionId: "tx-1", locale: "vi", role: "notice" } }), scopeOf())
        await steps.run(AT, fired("boss"), scopeOf())

        expect(hostInputOf(host, 0)?.step).toEqual({ nodeKey: "match", versionId: "v-1", workflowId: "wf-1" })
        expect(hostInputOf(host, 1)?.step).toEqual({ nodeKey: "match", versionId: "v-1", workflowId: "wf-1" })
    })
})

/** The two facts of a stop that say its engine line was not told, as a record (empty when it says no such thing). */
const lineFactsOf = (stop: ReturnType<Awaited<ReturnType<typeof build>>["stopOf"]>) =>
    Object.fromEntries(
        (stop?.detail.facts ?? []).filter((fact) => fact.name.startsWith("customerLine")).map((fact) => [fact.name, fact.value]),
    )

/** A step that stops with a holding line for conv-1, whose send answers `sent`. */
const troubledWithLine = async (sent: Awaited<ReturnType<NodeEffectExecutor["execute"]>>) => {
    const built = await build({ workflowName: "Doi soat" })
    built.host.run.mockRejectedValue(new OtherError({ code: "PAYMENT_REFUSED", params: { refusal: "order_closed" } }))
    built.core.decide.mockResolvedValue({ kind: "report", reason: "x", question: null, suggestions: [], customerLine: "Shop dang kiem tra a." })
    built.send.execute.mockResolvedValue(sent)
    await built.steps.run(AT, stateOf({ trigger: { routeId: "conv-1", locale: "vi" } }), scopeOf())
    return built
}

describe("ThreadStepService.run: the engine's own line to the customer on a stop", () => {
    it("is sent under the holding-line key with the step it is sent FOR (the workflow version it is named by), so it is filed on the engine's road", async () => {
        const { steps, host, core, send, graphs } = await build()
        host.run.mockRejectedValue(new OtherError({ code: "PAYMENT_REFUSED", params: { refusal: "order_closed" } }))
        core.decide.mockResolvedValue({ kind: "report", reason: "x", question: null, suggestions: [], customerLine: "Shop dang kiem tra a." })
        graphs.workflowVersionIdOf.mockResolvedValue("workflow-version-7")

        await steps.run({ ...AT, versionId: "graph-version-3" }, stateOf({ trigger: { routeId: "conv-1", locale: "vi" } }), scopeOf())

        expect(send.execute).toHaveBeenCalledTimes(1)
        const [speaker, payload, call] = send.execute.mock.calls[0] ?? []
        expect(payload).toEqual({ text: "Shop dang kiem tra a." })
        expect(call).toEqual({ key: "honest-line:run-1:match", dedupeKey: "honest-line:run-1:match" })
        // The step it is sent for, named by the workflow version, with the agent of the RUN (the node's rows are that agent's).
        expect(speaker?.step).toEqual({ nodeKey: "match", versionId: "workflow-version-7", workflowId: "wf-1", runAgentId: "agent-1" })
        expect(speaker?.conversationId).toBe("conv-1")
    })

    it.each([
        ["ability_off", "[agentGraphs.customerLineNotSent.off]"],
        ["ask_mode", "[agentGraphs.customerLineNotSent.ask]"],
        ["not_attached", "[agentGraphs.customerLineNotSent.detached]"],
    ])("switch on, the step's node refused it (%s): no line is recorded, the TEAM is told once in the engine's words, nothing of the customer's line is repeated", async (reason, words) => {
        const { post, stopOf } = await troubledWithLine({ kind: "refused", id: "channel_no_access", facts: { reason, rule: "node" } })

        const told = post.execute.mock.calls.filter((call) => call[2].key === "line-not-sent:run-1:match")
        expect(told).toHaveLength(1)
        expect(told[0]?.[1]).toMatchObject({ kind: "message.text", audience: "founder", title: "[agentGraphs.customerLineNotSent.title]" })
        expect(String(told[0]?.[1].text)).toContain(words)
        expect(String(told[0]?.[1].text)).not.toContain("Shop dang kiem tra")
        // The stop stays open, records no line as told, and says the line was NOT told, with the reason.
        expect(stopOf()?.state).toBe("open")
        expect(stopOf()?.customerLines).toEqual([])
        expect(lineFactsOf(stopOf())).toEqual({ customerLine: "not_told", customerLineReason: reason })
    })

    it.each([
        ["the agent's tick refuses (switch off)", { kind: "refused", id: "channel_no_access", facts: { reason: "ability_off" } }, "ability_off"],
        ["a person holds the conversation", { kind: "refused", id: "route_held" }, "route_held"],
    ] as const)("%s: the stop says the line was NOT told, with the reason, and never keeps it as told; no node post", async (_name, sent, reason) => {
        const { post, stopOf, cards } = await troubledWithLine(sent)

        expect(stopOf()?.customerLines).toEqual([])
        expect(lineFactsOf(stopOf())).toEqual({ customerLine: "not_told", customerLineReason: reason })
        // The card is rewritten with the truth.
        expect(cards.rewritten).toHaveBeenCalled()
        expect(post.execute.mock.calls.filter((call) => call[2].key.startsWith("line-not-sent:"))).toEqual([])
    })

    it("a line that was sent is recorded on the stop, and the team gets no such post", async () => {
        const { post, stopOf } = await troubledWithLine({ kind: "message", id: "line-1" })

        expect(stopOf()?.customerLines).toEqual([expect.objectContaining({ conversationId: "conv-1", text: "Shop dang kiem tra a." })])
        expect(lineFactsOf(stopOf())).toEqual({})
        expect(post.execute.mock.calls.filter((call) => call[2].key.startsWith("line-not-sent:"))).toEqual([])
    })
})

describe("ThreadStepService.run: a refused engine line never reaches lineSent", () => {
    it.each([
        ["switch off, the agent's tick", { kind: "refused", id: "channel_no_access", facts: { reason: "ability_off" } }],
        ["switch on, the step's node", { kind: "refused", id: "channel_no_access", facts: { reason: "ask_mode", rule: "node" } }],
        ["a refusal with an empty reason", { kind: "refused", id: "route_held", facts: { reason: "" } }],
    ] as const)("a line refused by %s is never handed to lineSent, only to lineNotTold", async (_name, sent) => {
        const lineSent = jest.spyOn(RunStopsService.prototype, "lineSent")
        const lineNotTold = jest.spyOn(RunStopsService.prototype, "lineNotTold")
        try {
            await troubledWithLine(sent)

            expect(lineSent).not.toHaveBeenCalled()
            expect(lineNotTold).toHaveBeenCalledTimes(1)
            const reason = "facts" in sent && typeof sent.facts.reason === "string" && sent.facts.reason !== "" ? sent.facts.reason : sent.id
            expect(lineNotTold.mock.calls[0]?.slice(1)).toEqual(["match", reason, { locale: "vi" }])
        } finally {
            lineSent.mockRestore()
            lineNotTold.mockRestore()
        }
    })
})

describe("ThreadStepService.run: the version a step is named by is always the WORKFLOW version", () => {
    it("a primary run pinned to an agent graph version names the workflow version that mirrors it, and asks once per pin", async () => {
        const { steps, host, graphs } = await build()
        host.run.mockResolvedValue({ output: {}, effects: [] })
        graphs.workflowVersionIdOf.mockResolvedValue("workflow-version-7")

        await steps.run({ ...AT, versionId: "graph-version-3" }, stateOf(), scopeOf())
        await steps.run({ ...AT, versionId: "graph-version-3" }, stateOf(), scopeOf())

        expect(graphs.workflowVersionIdOf).toHaveBeenCalledTimes(1)
        expect(graphs.workflowVersionIdOf).toHaveBeenCalledWith("ws-1", "agent-1", "graph-version-3")
        expect(hostInputOf(host, 0)?.step).toEqual({ nodeKey: "match", versionId: "workflow-version-7", workflowId: "wf-1" })
        expect(hostInputOf(host, 1)?.step).toEqual({ nodeKey: "match", versionId: "workflow-version-7", workflowId: "wf-1" })
        // The engine still reads the graph and the grant by the thread's own pin.
        expect(graphs.runGrantOf).toHaveBeenCalledWith("ws-1", "agent-1", "graph-version-3")
    })

    it("a run pinned to a workflow version (any other workflow, or a mirror) keeps that id", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: {}, effects: [] })

        await steps.run({ ...AT, versionId: "workflow-version-2" }, stateOf(), scopeOf())

        expect(hostInputOf(host)?.step).toEqual({ nodeKey: "match", versionId: "workflow-version-2", workflowId: "wf-1" })
    })

    it("a run that no workflow took is named by its pin and nothing is read (no node row can judge it)", async () => {
        const { steps, host, graphs } = await build()
        host.run.mockResolvedValue({ output: {}, effects: [] })

        await steps.run({ ...AT, versionId: "graph-version-3", workflowId: null }, stateOf(), scopeOf())

        expect(graphs.workflowVersionIdOf).not.toHaveBeenCalled()
        expect(hostInputOf(host)?.step).toEqual({ nodeKey: "match", versionId: "graph-version-3", workflowId: null })
    })
})

describe("ThreadStepService.run: one step of a thread", () => {
    it("runs the node under the key <run>:<step> with the thread's replay ports, keeps its output and goes to the next node", async () => {
        const { steps, host, records } = await build()
        host.run.mockResolvedValue({ output: { orderId: "o-1" }, effects: [] })

        await expect(steps.run(AT, stateOf(), scopeOf())).resolves.toEqual({
            update: { steps: { match: { output: { orderId: "o-1" } } }, trouble: null },
            goto: "settle",
        })
        expect(hostInputOf(host)).toMatchObject({ nodeId: "accounting.match-payment", key: "run-1:match" })
        // The run names its workflow step (the graph node, the pinned version, its workflow) for the audit and the node-level rights.
        expect(hostInputOf(host)?.step).toEqual({ nodeKey: "match", versionId: "v-1", workflowId: "wf-1" })
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
            reason: ORDER_CLOSED_REASON_VI,
            question: REFUND_OR_KEEP_VI,
            suggestions: [{ text: KEEP_IT_VI, handledBy: "person" }],
            customerLine: null,
        })

        const answer = await steps.run(AT, stateOf(), scopeOf())

        expect(core.decide).toHaveBeenCalledWith(expect.objectContaining({ nodeKey: "match", nodeStep: "accounting.match-payment" }))
        expect(records.open).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "ai_report", reason: ORDER_CLOSED_REASON_VI, contactId: null, conversationId: null }),
            NOW,
        )
        expect(answer).toEqual({
            update: {
                trouble: {
                    stepKey: "match",
                    question: expect.objectContaining({ stopId: "stop-1", kind: "ai_report", question: REFUND_OR_KEEP_VI }),
                    locale: "vi",
                },
            },
            goto: FREEZE_NODE,
        })
        expect(stopOf()?.detail.facts).toEqual(expect.arrayContaining([{ name: "code", value: "order_closed" }]))
    })

})

describe("ThreadStepService.run: a step that fails while a member of the shop holds the route (ruling R45)", () => {
    const onRoute = () => stateOf({ trigger: { routeId: "conv-1", contactId: "p-1", locale: "vi" } })
    const routeHeld = () => new OtherError({ code: "CUSTOMER_SEND_REFUSED", params: { refusal: "route_held" } })

    it("ends the run quietly: no AI core, no stop card, no hold of the subject; the run is `skipped` with code `route_held`", async () => {
        const { steps, host, core, records, cards, projection } = await build({ heldBy: "member-7" })
        host.run.mockRejectedValue(routeHeld())

        await expect(steps.run(AT, onRoute(), scopeOf())).resolves.toEqual({ goto: THREAD_END })

        expect(core.decide).not.toHaveBeenCalled()
        expect(records.open).not.toHaveBeenCalled()
        expect(cards.posted).not.toHaveBeenCalled()
        expect(projection.runEnded).toHaveBeenCalledWith(
            { workspaceId: REF.workspaceId, runId: REF.runId },
            { outcome: "skipped", code: "route_held", by: null, at: new Date(NOW) },
        )
    })

    it("stops for the founder as before when nobody holds the route, and when the run has no route at all", async () => {
        const free = await build()
        free.host.run.mockRejectedValue(routeHeld())
        free.core.decide.mockResolvedValue({ kind: "report", reason: "x", question: null, suggestions: [], customerLine: null })
        await expect(free.steps.run(AT, onRoute(), scopeOf())).resolves.toMatchObject({ goto: FREEZE_NODE })
        expect(free.records.open).toHaveBeenCalled()

        const noRoute = await build({ heldBy: "member-7" })
        noRoute.host.run.mockRejectedValue(routeHeld())
        noRoute.core.decide.mockResolvedValue({ kind: "report", reason: "x", question: null, suggestions: [], customerLine: null })
        await expect(noRoute.steps.run(AT, stateOf(), scopeOf())).resolves.toMatchObject({ goto: FREEZE_NODE })
        expect(noRoute.projection.runEnded).not.toHaveBeenCalled()
    })
})

describe("ThreadStepService.run: troubles before the node and an unreachable AI", () => {
    it("sends a failure BEFORE the node runs (the grant) through the AI core too: an AI report, never a silent engine error", async () => {
        const { steps, graphs, host, core, records } = await build()
        graphs.runGrantOf.mockRejectedValue(new OtherError({ code: "ENTITY_ENGINE_QUERY_INVALID", params: {} }))
        core.decide.mockResolvedValue({ kind: "report", reason: RIGHTS_UNREAD_REASON_VI, question: null, suggestions: [], customerLine: null })

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
        const { steps, host, core, records, post } = await build({ blocking: false, workflowName: SHOP_RECONCILE_TITLE_VI })
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
        expect(String(Reflect.get(payload ?? {}, "text"))).toContain(SHOP_RECONCILE_TITLE_VI)
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
        const { steps, host, core, records } = await build({ workflowName: SHOP_RECONCILE_TITLE_VI, conversationLead: "lead-7" })
        host.run.mockRejectedValue(new OtherError({ code: "PAYMENT_REFUSED", params: {} }))
        core.decide.mockResolvedValue({ kind: "report", reason: "x", question: null, suggestions: [], customerLine: null })
        const consult = stateOf({ trigger: { routeId: "conv-1", locale: "vi" } })

        await steps.run(AT, consult, scopeOf())

        expect(records.open).toHaveBeenCalledWith(
            expect.objectContaining({
                contactId: "lead-7",
                conversationId: "conv-1",
                card: expect.objectContaining({
                    workflow: { moduleKey: "sales", key: "consult", title: SHOP_RECONCILE_TITLE_VI },
                    step: { key: "match", nodeId: "accounting.match-payment", title: MATCH_STEP_TITLE_VI },
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
        expect(opened?.card.workflow.title).toBe(INSTALLED.templateOf("sales.consult")?.name.vi)
    })
})

/** Stops the step once, so the gate has a stop to route. */
const stopped = async (built: Awaited<ReturnType<typeof build>>) => {
    built.host.run.mockRejectedValueOnce(new OtherError({ code: "PAYMENT_REFUSED", params: {} }))
    built.core.decide.mockResolvedValue({
        kind: "report",
        reason: UNCLEAR_REASON_VI,
        question: WHICH_ORDER_QUESTION_VI,
        suggestions: [],
        customerLine: null,
    })
    const answer = await built.steps.run(AT, stateOf(), scopeOf())
    return stateOf({ trouble: answer.update?.trouble })
}

describe("ThreadStepService.gate and the founder's decisions", () => {
    it("hands the stop's question to scope.stop and waits there", async () => {
        const built = await build()
        const state = await stopped(built)
        const scope = scopeOf()

        await expect(built.steps.gate({ agentId: "agent-1" }, state, scope)).rejects.toThrow("interrupted")
        expect(scope.stop).toHaveBeenCalledWith(expect.objectContaining({ stepKey: "match", question: WHICH_ORDER_QUESTION_VI }))
    })

    it("an answer re-runs the step with the founder's words on its turn, and the step then completes the stop", async () => {
        const built = await build()
        const state = await stopped(built)
        const decision = { kind: "answer", text: OF_ORDER_SO3_VI, by: "owner-1", at: "2026-11-10T10:05:00.000Z" }

        const routed = await built.steps.gate({ agentId: "agent-1" }, state, scopeOf(decision))

        expect(routed).toEqual({
            update: { founderAnswers: [{ text: OF_ORDER_SO3_VI, at: "2026-11-10T10:05:00.000Z" }], trouble: null },
            goto: "match",
        })
        built.host.run.mockResolvedValue({ output: { orderId: "o-3" }, effects: [] })
        const rerun = stateOf({ founderAnswers: routed.update?.founderAnswers ?? [] })
        await expect(built.steps.run(AT, rerun, scopeOf())).resolves.toMatchObject({ goto: "settle" })
        expect(hostInputOf(built.host, 1)?.turn.founderAnswers).toEqual([{ text: OF_ORDER_SO3_VI, at: "2026-11-10T10:05:00.000Z" }])
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

})

describe("ThreadStepService.gate replayed and taken over", () => {
    it("a gate run again with the same decision after a crash keeps the founder's words once and routes the same way", async () => {
        const built = await build()
        const state = await stopped(built)
        const decision = { kind: "answer", text: OF_ORDER_SO3_VI, by: "owner-1", at: "2026-11-10T10:05:00.000Z" }

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

describe("ThreadStepService.run: a call that asks the owner first (an `ask` ability)", () => {
    const ASK = new GraphNodesError({
        code: GraphNodesErrorCode.ToolApprovalRequired,
        params: { tool: "nivo.tool.payment.transfer.create", fingerprint: "fp-1", reason: "ask_mode" },
    })
    const QUESTION = { reason: "Cho phep tao QR?", question: null, suggestions: [], decisions: ["retry", "take_over", "skip"] }

    it("goes to the approvals: one approval stop at the gate, no AI core, and the step row keeps no wait item", async () => {
        const approvals = mock<ThreadApprovalsService>()
        approvals.approvedRun.mockResolvedValue({ approval: null, answer: null })
        approvals.asked.mockResolvedValue({ kind: "stopped", question: QUESTION, workItemId: "item-1" } as never)
        const { steps, host, core, projection } = await build({ approvals })
        host.run.mockRejectedValue(ASK)

        const answered = await steps.run(AT, stateOf(), scopeOf())

        expect(answered).toEqual({
            update: { trouble: { stepKey: "match", question: QUESTION, locale: "vi" } },
            goto: FREEZE_NODE,
        })
        expect(approvals.asked).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: "ws-1",
                runId: "run-1",
                stepKey: "match",
                agentId: "agent-1",
                // The card's words are asked as this step's: the turn carries the step, named by its workflow version.
                turn: expect.objectContaining({ step: { nodeKey: "match", versionId: "v-1", workflowId: "wf-1" } }),
            }),
            ASK,
        )
        expect(core.decide).not.toHaveBeenCalled()
        expect(projection.stepStopped).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ code: "tool_approval_required", waitItemId: null }),
        )
        expect(hostInputOf(host)).not.toHaveProperty("approval")
    })

    it("runs the step again with the approved call's fingerprint once the owner approved it", async () => {
        const approvals = mock<ThreadApprovalsService>()
        approvals.approvedRun.mockResolvedValue({ approval: { by: "owner-1", fingerprint: "fp-1" }, answer: null })
        const { steps, host } = await build({ approvals })
        host.run.mockResolvedValue({ output: { orderId: "o-1" }, effects: [] })

        await steps.run(AT, stateOf(), scopeOf())

        expect(approvals.approvedRun).toHaveBeenCalledWith(
            { workspaceId: "ws-1", runId: "run-1" },
            "match",
            expect.objectContaining({ turnId: "run-1" }),
            { nodeKey: "match", versionId: "v-1", workflowId: "wf-1" },
        )
        expect(hostInputOf(host)?.approval).toEqual({ by: "owner-1", fingerprint: "fp-1" })
        expect(hostInputOf(host)?.turn.founderAnswers).toBeUndefined()
    })

    // FX4 (D-P11-5): the engine ran the approved call; the model reads its answer among the founder's answers (written by the engine).
    it("hands the model the answer of the approved call the engine ran, as the engine's words among the founder's answers", async () => {
        const approvals = mock<ThreadApprovalsService>()
        const answer = { text: "The owner approved the call nivo.x; its answer: {}", at: "2026-11-11T00:00:00.000Z", by: "engine" as const }
        approvals.approvedRun.mockResolvedValue({ approval: { by: "owner-1", fingerprint: "fp-1" }, answer })
        const { steps, host } = await build({ approvals })
        host.run.mockResolvedValue({ output: { orderId: "o-1" }, effects: [] })

        await steps.run(AT, stateOf(), scopeOf())

        expect(hostInputOf(host)?.turn.founderAnswers).toEqual([answer])
    })

    it("a call refused before (or approved and still asking) is the step's trouble: the AI core reads it", async () => {
        const approvals = mock<ThreadApprovalsService>()
        approvals.approvedRun.mockResolvedValue({ approval: null, answer: null })
        approvals.asked.mockResolvedValue({ kind: "trouble", code: "tool_approval_refused", text: "refused" })
        const { steps, host, core } = await build({ approvals })
        host.run.mockRejectedValue(ASK)

        await steps.run(AT, stateOf(), scopeOf())

        expect(core.decide).toHaveBeenCalled()
        expect(JSON.stringify(core.decide.mock.calls[0])).toContain("tool_approval_refused")
    })
})

describe("ThreadStepService.run: the model of the node (model per node)", () => {
    it("hands the host the model the graph's node names, the shop's choice over blocks-core's table", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: { orderId: "o-1" }, effects: [] })
        const chosen = {
            ...FLOW,
            nodes: FLOW.nodes.map((node) => (node.key === "match" ? { ...node, model: "deepseek/deepseek-v4.1-flash" } : node)),
        }

        await steps.run({ ...AT, flow: chosen }, stateOf(), scopeOf())

        expect(hostInputOf(host)?.model).toBe("deepseek/deepseek-v4.1-flash")
    })

    it("names no model for a node that names none, so the host takes blocks-core's for the step", async () => {
        const { steps, host } = await build()
        host.run.mockResolvedValue({ output: { orderId: "o-1" }, effects: [] })

        await steps.run(AT, stateOf(), scopeOf())

        expect(hostInputOf(host)).not.toHaveProperty("model")
    })
})
