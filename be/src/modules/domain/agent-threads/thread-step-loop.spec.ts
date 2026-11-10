import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    AgentGraphAiCoreService,
    AgentGraphStepMemoryService,
    AgentGraphsService,
    AgentWorkflowRunsService,
} from "@modules/domain/agent-graphs"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { GraphNodeHostService, GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeRunInput } from "@modules/domain/graph-nodes"
import { CHECKPOINT_STORE, GRAPH_THREADS, LanggraphModule } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadGraph } from "@modules/integrations/langgraph"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { memoryCheckpointStore } from "@tests/fixtures/builders/checkpoint-store.builder"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import type { StopBuild } from "./stops/run-stop-records.service"
import type { RunStop, StopOpen } from "./stops/run-stop.contracts"
import { RunStopsService } from "./stops/run-stops.service"
import { StopCardsService } from "./stops/stop-cards.service"
import { compileTemplate } from "./template-compiler.policy"
import type { CompiledTemplate } from "./template-compiler.policy"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadStepService } from "./thread-step.service"

// Package T (phase 3): the for-each RUNTIME. The real node function (`ThreadStepService.run` / `gate`) drives a compiled for-each on the
// real LangGraph port: one iteration after the other, each body step under `<node>[<i>]` (its own ledger key) with the element in its
// input, the loop's output in the old engine's shape; a kill mid-iteration goes on in that iteration, never one already joined; a stop
// inside an iteration is keyed by the iteration and the founder's answer goes back to the same node in the same iteration.

const NOW = "2026-11-11T10:00:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-loop" }
const ITEMS = ["rose", "lily", "tulip"]

const node = (key: string, step: string, more: Partial<GraphSpecNode> = {}): GraphSpecNode => ({ key, kind: "execute", step, ...more })

/** A list, a for-each over it whose body prices then notes each element, and a step after the loop. */
const LOOP_SPEC: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [
        node("list", "spec.list", { next: "each" }),
        node("each", "core.for-each", { routes: { body: "price" }, next: "after" }),
        node("price", "spec.price", { next: "note" }),
        node("note", "spec.note"),
        node("after", "spec.after"),
    ],
}

const NODE_IDS = ["spec.list", "core.for-each", "spec.price", "spec.note", "spec.after"]

const compiledOf = (): CompiledTemplate => {
    const result = compileTemplate(
        {
            pin: { versionId: "v-loop", workflowId: null, number: 1, documentHash: null, templateId: null, templateVersion: null },
            spec: LOOP_SPEC,
        },
        new Set(NODE_IDS),
        { loops: true },
    )
    if (result.kind === "refused") throw new Error(JSON.stringify(result.problems))
    return result.graph
}

@Module({})
class LoopRuntimeWorldModule {}

/** What a spec changes: a step key whose visit is killed once (before its node runs), a step key whose node fails once. */
interface World {
    killAt?: string | null
    failAt?: string | null
}

const build = async (world: World) => {
    let stop: RunStop | null = null
    const ran: Array<string> = []
    const host = mock<GraphNodeHostService>()
    host.run.mockImplementation(async (input: NodeRunInput) => {
        const stepKey = input.key.slice(`${REF.runId}:`.length)
        ran.push(stepKey)
        if (world.failAt === stepKey) {
            world.failAt = null
            return { code: "SPEC_FAILED", text: "the price list was unreachable" } as never
        }
        const item: unknown = Reflect.get(input.input ?? {}, "item")
        if (input.nodeId === "core.for-each") return { output: { results: ITEMS.map(() => null), okCount: 3, failed: [] }, effects: [] }
        if (input.nodeId === "spec.price") return { output: { priced: item }, effects: [] }
        if (input.nodeId === "spec.note") return { output: { noted: item }, effects: [] }
        return { output: { done: true }, effects: [] }
    })
    const memory = mock<AgentGraphStepMemoryService>()
    // The binding hands a body node the element: the engine puts it in the step input, the spec's binding passes it on.
    memory.bind.mockImplementation(((graphNode: GraphSpecNode, scope: unknown) =>
        Promise.resolve({ params: {}, input: graphNode.key === "each" ? { items: ITEMS } : { item: Reflect.get(Object(scope), "item") } })) as never)
    memory.scopeOf.mockImplementation(((_view: unknown, _flow: unknown, input: { item?: { value: unknown } }) =>
        Promise.resolve({ item: input.item?.value ?? null })) as never)
    const projection = mock<ThreadProjectionService>()
    projection.stepStarted.mockImplementation(((_ref: unknown, fact: { spec: { stepKey: string } }) => {
        if (world.killAt === fact.spec.stepKey) {
            world.killAt = null
            return Promise.reject(new Error(`killed at ${fact.spec.stepKey}`))
        }
        return Promise.resolve()
    }) as never)
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
                answers: [],
                decision: null,
                repeats: 1,
                stoppedAt: NOW,
                resolvedAt: null,
            }
            return Promise.resolve(stop)
        }),
        byRunStep: jest.fn((_ws: string, _run: string, stepKey: string) =>
            Promise.resolve(stop !== null && stop.stepKey === stepKey ? stop : null),
        ),
        patch: jest.fn((_ws: string, _id: string, change: StopBuild) => {
            if (stop === null) return Promise.resolve(null)
            const values = change(stop)
            if (values === null) return Promise.resolve(null)
            stop = { ...stop, ...values }
            return Promise.resolve(stop)
        }),
    })
    const definitions = new Map(NODE_IDS.map((id) => [id, { effects: [], title: { vi: id, en: id } }]))
    const providers = [
        { provide: CHECKPOINT_STORE, useValue: memoryCheckpointStore().port },
        { provide: LOGGER, useValue: mock<Logger>() },
    ]
    const globals: DynamicModule = {
        module: LoopRuntimeWorldModule,
        global: true,
        providers,
        exports: providers.map((one) => one.provide),
    }
    const moduleRef = await Test.createTestingModule({
        imports: [globals, LanggraphModule.register({ isGlobal: true, compiledMax: 5, stepLimit: 200 })],
        providers: [
            ThreadStepService,
            RunStopsService,
            { provide: RunStopRecordsService, useValue: records },
            {
                provide: StopCardsService,
                useValue: mock<StopCardsService>({ posted: jest.fn().mockResolvedValue("msg-1"), resolved: jest.fn().mockResolvedValue(undefined) }),
            },
            {
                provide: AgentGraphsService,
                useValue: mock<AgentGraphsService>({ runGrantOf: jest.fn().mockResolvedValue({ rights: [], tools: [], effects: null }) }),
            },
            { provide: GraphNodeHostService, useValue: host },
            {
                provide: GraphNodeRegistryService,
                useValue: mock<GraphNodeRegistryService>({
                    installed: jest.fn(() => ({ nodes: definitions }) as never),
                    optionalExecutorOf: jest.fn().mockReturnValue(undefined),
                }),
            },
            { provide: AgentGraphAiCoreService, useValue: mock<AgentGraphAiCoreService>({ decide: jest.fn().mockResolvedValue(null) }) },
            { provide: AgentGraphStepMemoryService, useValue: memory },
            { provide: AgentWorkflowRunsService, useValue: mock<AgentWorkflowRunsService>({ pinsOf: jest.fn().mockResolvedValue([]) }) },
            {
                provide: ChatConversationsService,
                useValue: mock<ChatConversationsService>({
                    leadIdOf: jest.fn().mockResolvedValue(null),
                    ofLeads: jest.fn().mockResolvedValue([]),
                }),
            },
            { provide: ThreadProjectionService, useValue: projection },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
        ],
    }).compile()
    const steps = moduleRef.get(ThreadStepService)
    const threads = moduleRef.get<GraphThreads>(GRAPH_THREADS)
    const compiled = compiledOf()
    const run = { agentId: "agent-1", versionId: "v-loop", flow: LOOP_SPEC, namespace: "sales.loop", workflowId: null, replay: threads.replayPortsOf }
    const graph: ThreadGraph = {
        version: "v-loop",
        entry: compiled.entry,
        nodes: [
            ...compiled.nodes.map((step) => ({
                key: step.key,
                ends: step.ends,
                run: (state: Parameters<ThreadStepService["run"]>[1], scope: Parameters<ThreadStepService["run"]>[2]) =>
                    steps.run({ ...run, step }, state, scope),
            })),
            {
                key: compiled.freeze.key,
                ends: compiled.freeze.ends,
                run: (state: Parameters<ThreadStepService["gate"]>[1], scope: Parameters<ThreadStepService["gate"]>[2]) =>
                    steps.gate({ agentId: "agent-1" }, state, scope),
            },
        ],
    }
    return { threads, graph, ran, stopOf: () => stop }
}

/** The loop's output in the old engine's shape: every element, the output of its last body step. */
const SUMMARY = {
    results: ITEMS.map((item, index) => ({ index, item, output: { noted: item } })),
    okCount: 3,
    failed: [],
}

const BODY_ORDER = ["list", "each", "price[0]", "note[0]", "price[1]", "note[1]", "price[2]", "note[2]", "after"]

describe("the for-each runtime on the real node function and the real LangGraph port", () => {
    it("runs the body once per element, in order, each step under its iteration's key with the element, then the step after", async () => {
        const { threads, graph, ran } = await build({})

        const outcome = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(ran).toEqual(BODY_ORDER)
        expect(outcome.status).toBe("ended")
        const state = outcome.status === "ended" ? outcome.state : null
        expect(state?.steps.each).toEqual({ output: SUMMARY })
        expect(state?.steps["price[1]"]).toEqual({ output: { priced: "lily" } })
        expect(state?.loop).toBeNull()
    })

    it("a kill mid-iteration goes on in that iteration: no iteration already joined runs again, no step twice", async () => {
        const { threads, graph, ran } = await build({ killAt: "note[1]" })

        await expect(threads.start(REF, graph, { trigger: { locale: "vi" } })).rejects.toThrow("killed at note[1]")
        expect(ran).toEqual(["list", "each", "price[0]", "note[0]", "price[1]"])
        const outcome = await threads.drive(REF, graph)

        expect(ran).toEqual(BODY_ORDER)
        expect(outcome.status === "ended" ? outcome.state.steps.each : null).toEqual({ output: SUMMARY })
    })

    it("stops inside an iteration under the iteration's key, and the founder's retry runs the same node in the same iteration", async () => {
        const { threads, graph, ran, stopOf } = await build({ failAt: "price[1]" })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(stopped.status).toBe("stopped")
        expect(stopOf()?.stepKey).toBe("price[1]")
        const resumed = await threads.resume(REF, graph, { kind: "retry", by: "user-owner", at: NOW })

        expect(ran).toEqual(["list", "each", "price[0]", "note[0]", "price[1]", "price[1]", "note[1]", "price[2]", "note[2]", "after"])
        expect(resumed.status === "ended" ? resumed.state.steps.each : null).toEqual({ output: SUMMARY })
    })
})
