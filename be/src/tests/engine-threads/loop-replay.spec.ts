import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { LOOP_ITEM_SELF_KEY } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { FOREACH_ITEM_KEY_DUPLICATE, LOOP_MAX, callDigestOf } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    AgentGraphAiCoreService,
    AgentGraphStepMemoryService,
    AgentGraphsService,
    AgentWorkflowRunsService,
} from "@modules/domain/agent-graphs"
import {
    RunStopRecordsService,
    RunStopsService,
    ThreadProjectionService,
    ThreadStepService,
    compileTemplate,
} from "@modules/domain/agent-threads"
import type { RunStop, StopOpen } from "@modules/domain/agent-threads"
import { StopCardsService } from "@modules/domain/agent-threads/stops"
import type { StopBuild } from "@modules/domain/agent-threads/stops"
import { GraphNodeEffectsService, GraphNodeHostService, GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeRunInput } from "@modules/domain/graph-nodes"
import { CHECKPOINT_STORE, DEFAULT_CHECKPOINT_LIMITS, GRAPH_THREADS, LanggraphModule } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadGraph, ThreadState } from "@modules/integrations/langgraph"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { memoryCheckpointStore } from "@tests/fixtures/builders/checkpoint-store.builder"

/** What a loop body's scope reads of its input: the item, boxed. */
interface ScopeInput {
    /** The item of the round, boxed. */
    readonly item?: ItemBox
}

/** One boxed loop item. */
interface ItemBox {
    /** The item itself. */
    readonly value: unknown
}

/** The fact a step start is recorded with. */
interface StepFact {
    /** The step's spec. */
    readonly spec: StepKeySpec
}

/** The key of a step. */
interface StepKeySpec {
    /** The step's key. */
    readonly stepKey: string
}


// Slice E2 (TOOLS-LEAD contract C4 "forEach replay, per ITEM"; engine plan §3): a for-each whose body is SEVERAL nodes, `send` then
// `record`, replays per ITEM on the real node function (`ThreadStepService.run` / `gate`), the real stops and the real LangGraph port.
// Every body step runs under `<loop>[<item>].<node>`, the key the host hands the ledger: the world's host keeps each effect under the
// ledger's own key form (`call:<runId>:<stepKey>:<callDigest>`, `graph-node-effects.service.ts`) and counts what reached the outside
// world, so "once" is counted where it matters. The three items carry the SAME business args on purpose: only their identity
// (`itemKey: "orderId"`) tells their calls apart.

const NOW = "2026-11-12T08:00:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-replay" }

/** The one message every item sends: equal args for every item. */
const SEND_ARGS = { conversationId: "conv-1", text: "Nhac thanh toan" }

/** A note the record keeps, about 2 KB, so the 50-item checkpoint is measured with outputs of a realistic size. */
const NOTE = "n".repeat(2048)

const node = (key: string, step: string, more: Partial<GraphSpecNode> = {}): GraphSpecNode => ({ key, kind: "execute", step, ...more })

/**
 * A list, a for-each over it keyed by `orderId` that gathers `record`, a body `send → record`, and a step after the loop. The loop's
 * params are the ones a `nivo/agent-graph@2` for-each step carries (`max`, `collect`, `itemKey`); `@1` documents without them are
 * proved by `thread-step-loop.spec.ts`.
 */
const specOf = (itemKey: string | null): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [TOOL.customerMessageSend] },
    nodes: [
        node("list", "spec.list", { next: "each" }),
        node("each", "core.for-each", {
            params: { max: LOOP_MAX, collect: "record", ...(itemKey === null ? {} : { itemKey }) },
            routes: { body: "send" },
            next: "after",
        }),
        node("send", "spec.send", { next: "record" }),
        node("record", "spec.record"),
        node("after", "spec.after"),
    ],
})

const LOOP_SPEC: GraphSpec = specOf("orderId")

const NODE_IDS = ["spec.list", "core.for-each", "spec.send", "spec.record", "spec.after"]

/** `count` orders with ids `o-1`…, the same customer and the same reminder text. */
const ordersOf = (count: number): ReadonlyArray<Readonly<Record<string, string>>> =>
    Array.from({ length: count }, (_item, at) => ({ orderId: `o-${String(at + 1)}`, customerId: "c-1" }))

@Module({})
class LoopReplayWorldModule {}

/** What a case changes: the list, the step key whose node fails once, the step key whose visit is killed once (before its node runs). */
interface World {
    items: ReadonlyArray<unknown>
    failAt?: string | null
    killAt?: string | null
    /** The step key whose node throws once AFTER its effect reached the outside world (the call left, the step never completed). */
    killAfterEffectAt?: string | null
    /** The loop's `itemKey` (a member path, `"."` for the item itself, null for the index); absent: `orderId`. */
    itemKey?: string | null
}

/** One effect the ledger keeps: its key, and the step it was made in. */
interface LedgerRow {
    readonly key: string
    readonly stepKey: string
}

const build = async (world: World) => {
    let stop: RunStop | null = null
    /** Every visit the host ran, by step key, in order. */
    const ran: Array<string> = []
    /** Every send that reached the outside world, by step key. */
    const sent: Array<string> = []
    /** The ledger: one row per effect key; a recorded key answers from here and is not executed again. */
    const ledger = new Map<string, LedgerRow>()
    const host = mock<GraphNodeHostService>()
    host.run.mockImplementation(async (input: NodeRunInput) => {
        const stepKey = input.key.slice(`${REF.runId}:`.length)
        ran.push(stepKey)
        const item: unknown = Reflect.get(Object(input.input), "item")
        const orderId =
            typeof item === "string" ? item : typeof item === "object" && item !== null ? String(Reflect.get(item, "orderId")) : ""
        if (input.nodeId === "spec.list") return { output: { orders: world.items }, effects: [] }
        if (input.nodeId === "core.for-each") return { output: { items: [], held: null, results: [] }, effects: [] }
        if (input.nodeId === "spec.send") {
            const key = `call:${input.key}:${callDigestOf(TOOL.customerMessageSend, SEND_ARGS)}`
            if (!ledger.has(key)) {
                sent.push(stepKey)
                ledger.set(key, { key, stepKey })
            }
            if (world.killAfterEffectAt === stepKey) {
                world.killAfterEffectAt = null
                throw new Error(`killed after the send of ${stepKey}`)
            }
            return { output: { messageId: `m-${orderId}` }, effects: [] }
        }
        if (input.nodeId === "spec.record") {
            if (world.failAt === stepKey) {
                world.failAt = null
                return { code: "SPEC_RECORD_FAILED", text: "the sheet was unreachable" } as never
            }
            return { output: { recorded: orderId, note: NOTE }, effects: [] }
        }
        return { output: { done: true }, effects: [] }
    })
    const memory = mock<AgentGraphStepMemoryService>()
    // The binding hands the loop its list and a body node the element (the engine puts it in the step input).
    memory.bind.mockImplementation(((graphNode: GraphSpecNode, scope: unknown) =>
        Promise.resolve({
            params: {},
            input: graphNode.key === "each" ? { items: world.items } : { item: Reflect.get(Object(scope), "item") },
        })) as never)
    memory.scopeOf.mockImplementation(((_view: unknown, _flow: unknown, input: ScopeInput) =>
        Promise.resolve({ item: input.item?.value ?? null })) as never)
    const projection = mock<ThreadProjectionService>()
    projection.stepStarted.mockImplementation(((_ref: unknown, fact: StepFact) => {
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
                contactId: input.contactId,
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
    const core = mock<AgentGraphAiCoreService>({ decide: jest.fn().mockResolvedValue(null) })
    const definitions = new Map(NODE_IDS.map((id) => [id, { effects: [], title: { vi: id, en: id } }]))
    const providers = [
        { provide: CHECKPOINT_STORE, useValue: memoryCheckpointStore().port },
        { provide: LOGGER, useValue: mock<Logger>() },
    ]
    const globals: DynamicModule = {
        module: LoopReplayWorldModule,
        global: true,
        providers,
        exports: providers.map((one) => one.provide),
    }
    const moduleRef = await Test.createTestingModule({
        imports: [globals, LanggraphModule.register({ isGlobal: true, compiledMax: 5, stepLimit: 400 })],
        providers: [
            ThreadStepService,
            RunStopsService,
            { provide: RunStopRecordsService, useValue: records },
            { provide: GraphNodeEffectsService, useValue: mock<GraphNodeEffectsService>({ recordsOf: jest.fn().mockResolvedValue([]) }) },
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
                    optionalExecutorOf: jest.fn(() => undefined) as never,
                }),
            },
            { provide: AgentGraphAiCoreService, useValue: core },
            { provide: AgentGraphStepMemoryService, useValue: memory },
            { provide: AgentWorkflowRunsService, useValue: mock<AgentWorkflowRunsService>({ pinsOf: jest.fn().mockResolvedValue([]) }) },
            { provide: ThreadProjectionService, useValue: projection },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
        ],
    }).compile()
    const steps = moduleRef.get(ThreadStepService)
    const threads = moduleRef.get<GraphThreads>(GRAPH_THREADS)
    const flow = world.itemKey === undefined ? LOOP_SPEC : specOf(world.itemKey)
    const compiled = compileTemplate(
        {
            pin: { versionId: "v-replay", workflowId: null, number: 1, documentHash: null, templateId: null, templateVersion: null },
            spec: flow,
        },
        new Set(NODE_IDS),
        { loops: true },
    )
    if (compiled.kind === "refused") throw new Error(JSON.stringify(compiled.problems))
    const run = { agentId: "agent-1", versionId: "v-replay", flow, namespace: "sales.round", workflowId: null, replay: threads.replayPortsOf }
    const graph: ThreadGraph = {
        version: "v-replay",
        entry: compiled.graph.entry,
        nodes: [
            ...compiled.graph.nodes.map((step) => ({
                key: step.key,
                ends: step.ends,
                run: (state: Parameters<ThreadStepService["run"]>[1], scope: Parameters<ThreadStepService["run"]>[2]) =>
                    steps.run({ ...run, step }, state, scope),
            })),
            {
                key: compiled.graph.freeze.key,
                ends: compiled.graph.freeze.ends,
                run: (state: Parameters<ThreadStepService["gate"]>[1], scope: Parameters<ThreadStepService["gate"]>[2]) =>
                    steps.gate({ agentId: "agent-1" }, state, scope),
            },
        ],
    }
    return { threads, graph, ran, sent, ledger, core, host, stopOf: () => stop }
}

/** The step keys of one item's body, in order. */
const itemSteps = (orderId: string): ReadonlyArray<string> => [`each[${orderId}].send`, `each[${orderId}].record`]

/** How many times a step key ran. */
const timesOf = (ran: ReadonlyArray<string>, stepKey: string): number => ran.filter((one) => one === stepKey).length

/** The loop's output a thread ended with. */
const loopOutputOf = (state: ThreadState | null): unknown => {
    const step: unknown = state?.steps.each
    return typeof step === "object" && step !== null ? Reflect.get(step, "output") : undefined
}

/** What `record` gathers for an order. */
const recordedOf = (orderId: string) => ({ key: orderId, output: { recorded: orderId, note: NOTE } })

describe("forEach replay per ITEM: a body of two nodes, keyed by a business id, on the real node function and LangGraph port", () => {
    it("a failed second body node in item 2: after the retry `send` ran once per item, item 2's send was not re-run, items 1 and 3 never twice", async () => {
        const { threads, graph, ran, sent, ledger, stopOf } = await build({ items: ordersOf(3), failAt: "each[o-2].record" })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        // The freeze inside item 2 holds the run there: item 3 has not started.
        expect(stopped.status).toBe("stopped")
        expect(stopOf()?.stepKey).toBe("each[o-2].record")
        expect(ran).toEqual(["list", "each", ...itemSteps("o-1"), ...itemSteps("o-2")])
        expect(ran.some((one) => one.startsWith("each[o-3]"))).toBe(false)

        const resumed = await threads.resume(REF, graph, { kind: "retry", by: "user-owner", at: NOW })

        expect(resumed.status).toBe("ended")
        // Only the failed node runs again in item 2; its `send` is reused, not re-executed.
        expect(ran).toEqual(["list", "each", ...itemSteps("o-1"), ...itemSteps("o-2"), "each[o-2].record", ...itemSteps("o-3"), "after"])
        expect(timesOf(ran, "each[o-2].send")).toBe(1)
        for (const stepKey of [...itemSteps("o-1"), ...itemSteps("o-3")]) expect(timesOf(ran, stepKey)).toBe(1)
        // Three sends reached the outside world, one per item, although the three items sent EQUAL args: three ledger rows.
        expect(sent).toEqual(["each[o-1].send", "each[o-2].send", "each[o-3].send"])
        expect([...ledger.values()].map((row) => row.stepKey)).toEqual(["each[o-1].send", "each[o-2].send", "each[o-3].send"])
        expect(new Set([...ledger.keys()]).size).toBe(3)
        // The loop gathered `record`'s output (the declared `collect`), not `send`'s.
        expect(loopOutputOf(resumed.status === "ended" ? resumed.state : null)).toEqual({
            items: ["o-1", "o-2", "o-3"].map((orderId) => recordedOf(orderId)),
            held: null,
            results: ["o-1", "o-2", "o-3"].map((orderId) => recordedOf(orderId).output),
        })
    })

    it("a kill before item 2's record goes on in that item: no joined item and no send runs again", async () => {
        const { threads, graph, ran, sent } = await build({ items: ordersOf(3), killAt: "each[o-2].record" })

        await expect(threads.start(REF, graph, { trigger: { locale: "vi" } })).rejects.toThrow("killed at each[o-2].record")
        expect(ran.some((one) => one.startsWith("each[o-3]"))).toBe(false)
        const outcome = await threads.drive(REF, graph)

        expect(outcome.status).toBe("ended")
        expect(ran).toEqual(["list", "each", ...itemSteps("o-1"), ...itemSteps("o-2"), ...itemSteps("o-3"), "after"])
        expect(sent).toEqual(["each[o-1].send", "each[o-2].send", "each[o-3].send"])
    })

    it("item 2's send fails AFTER its message left: the retry re-runs that node under the SAME key, the ledger answers, the customer is told once", async () => {
        const { threads, graph, ran, sent, ledger, stopOf } = await build({ items: ordersOf(3), killAfterEffectAt: "each[o-2].send" })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })
        expect(stopped.status).toBe("stopped")
        expect(stopOf()?.stepKey).toBe("each[o-2].send")
        const outcome = await threads.resume(REF, graph, { kind: "retry", by: "user-owner", at: NOW })

        expect(outcome.status).toBe("ended")
        expect(timesOf(ran, "each[o-2].send")).toBe(2)
        expect(sent).toEqual(["each[o-1].send", "each[o-2].send", "each[o-3].send"])
        expect(ledger.size).toBe(3)
    })

    it("52 items: the first 50 run, the rest are held (count and first key), never a failure; the checkpoint stays under its ceiling", async () => {
        const { threads, graph, ran, sent } = await build({ items: ordersOf(52) })

        const outcome = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(outcome.status).toBe("ended")
        const state = outcome.status === "ended" ? outcome.state : null
        const output = loopOutputOf(state)
        expect(output).toMatchObject({ held: { count: 2, firstKey: "o-51" } })
        expect(Reflect.get(Object(output), "items")).toHaveLength(LOOP_MAX)
        expect(sent).toHaveLength(LOOP_MAX)
        expect(ran.some((one) => one.startsWith("each[o-51]") || one.startsWith("each[o-52]"))).toBe(false)
        expect(ran.at(-1)).toBe("after")
        // 50 items × two body outputs (one of ~2 KB) + the loop's output: measured, not assumed.
        const bytes = Buffer.byteLength(JSON.stringify({ steps: state?.steps, loop: state?.loop }), "utf8")
        expect(bytes).toBeGreaterThan(LOOP_MAX * NOTE.length * 2)
        expect(bytes).toBeLessThan(DEFAULT_CHECKPOINT_LIMITS.maxBytes)
    })

    it("a list where two items share an orderId stops the loop node for a person before item 1 runs, without asking the AI core", async () => {
        const items = [{ orderId: "o-1" }, { orderId: "o-2" }, { orderId: "o-1" }]
        const { threads, graph, ran, sent, core, stopOf } = await build({ items })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(stopped.status).toBe("stopped")
        expect(ran).toEqual(["list", "each"])
        expect(sent).toEqual([])
        expect(stopOf()).toMatchObject({ stepKey: "each", kind: "engine" })
        expect(JSON.stringify(stopOf()?.detail.facts)).toContain(FOREACH_ITEM_KEY_DUPLICATE)
        expect(core.decide).not.toHaveBeenCalled()
    })
})

describe('a loop over plain values keyed by the value itself ("."), and a list re-ordered between the failure and the retry', () => {
    it("keys every body step by the item's own value and runs each item once", async () => {
        const { threads, graph, ran, sent } = await build({ items: ["web-basic", "seo", "hosting"], itemKey: LOOP_ITEM_SELF_KEY })

        const outcome = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(outcome.status).toBe("ended")
        expect(ran).toEqual(["list", "each", ...itemSteps("web-basic"), ...itemSteps("seo"), ...itemSteps("hosting"), "after"])
        expect(sent).toEqual(["each[web-basic].send", "each[seo].send", "each[hosting].send"])
        expect(loopOutputOf(outcome.status === "ended" ? outcome.state : null)).toMatchObject({
            items: ["web-basic", "seo", "hosting"].map((code) => recordedOf(code)),
        })
    })

    it("two equal values stop the loop node before any item runs", async () => {
        const { threads, graph, ran, sent, stopOf } = await build({ items: ["seo", "web", "seo"], itemKey: LOOP_ITEM_SELF_KEY })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(stopped.status).toBe("stopped")
        expect(ran).toEqual(["list", "each"])
        expect(sent).toEqual([])
        expect(stopOf()).toMatchObject({ stepKey: "each", kind: "engine" })
        expect(JSON.stringify(stopOf()?.detail.facts)).toContain(FOREACH_ITEM_KEY_DUPLICATE)
    })

    // The answer to "or say the index is safe": the list is the loop's RECORDED input. The loop node reads it once, when the loop starts,
    // and writes the items and their keys into the checkpointed frame (`state.loop.items` / `keys`); a retry or a crash resume goes on
    // from that frame and never reads the list again. The world below hands the loop a list that CHANGED ORDER after the failure: the
    // run goes on over the list it recorded, so even index keys replay each item's own steps within a run.
    const cases: ReadonlyArray<readonly [string, string | null]> = [
        ['keyed by the value itself (".")', LOOP_ITEM_SELF_KEY],
        ["keyed by the index (no key)", null],
    ]
    for (const [name, itemKey] of cases)
        it(`${name}: after the retry each item runs its OWN steps; the re-ordered list is never read`, async () => {
            const codes = ["web-basic", "seo", "hosting"]
            const keys = codes.map((code, at) => (itemKey === null ? String(at) : code))
            const [first = "", second = "", third = ""] = keys
            const world: World = { items: codes, itemKey, failAt: `each[${second}].record` }
            const { threads, graph, ran, sent, ledger, host } = await build(world)

            const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })
            expect(stopped.status).toBe("stopped")
            // Between the failure and the retry the source list changes order (a re-read would hand the loop this one).
            world.items = ["hosting", "seo", "web-basic"]

            const resumed = await threads.resume(REF, graph, { kind: "retry", by: "user-owner", at: NOW })

            expect(resumed.status).toBe("ended")
            // The list and the loop node ran once: the list was read once, before the failure.
            expect(timesOf(ran, "list")).toBe(1)
            expect(timesOf(ran, "each")).toBe(1)
            // Item 2 re-ran only its failed node; item 1 never ran again; item 3 ran once, after the retry.
            expect(ran).toEqual(["list", "each", ...itemSteps(first), ...itemSteps(second), `each[${second}].record`, ...itemSteps(third), "after"])
            expect(sent).toEqual([`each[${first}].send`, `each[${second}].send`, `each[${third}].send`])
            expect(ledger.size).toBe(3)
            // Every body step was handed ITS recorded item, in the recorded order: never the re-ordered list's item at that place.
            const handed = host.run.mock.calls
                .map(([input]): readonly [string, unknown] => [input.key.slice(`${REF.runId}:`.length), Reflect.get(Object(input.input), "item")])
                .filter(([stepKey]) => stepKey.startsWith("each["))
            expect(handed).toEqual([
                [`each[${first}].send`, "web-basic"],
                [`each[${first}].record`, "web-basic"],
                [`each[${second}].send`, "seo"],
                [`each[${second}].record`, "seo"],
                [`each[${second}].record`, "seo"],
                [`each[${third}].send`, "hosting"],
                [`each[${third}].record`, "hosting"],
            ])
            expect(loopOutputOf(resumed.status === "ended" ? resumed.state : null)).toMatchObject({
                items: codes.map((code, at) => ({ key: keys[at], output: { recorded: code } })),
            })
        })
})
