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


// TOOLS-LEAD L2 (concept `langgraphMap2026_11_12`: "loop over → Send fan-out with a concurrency cap and a reducer"): a `loop({ over })`
// whose `concurrency` is above 1 runs its items as LangGraph `Send` branches, a window of `concurrency` items at a time, on the REAL
// node function (`ThreadStepService.run` / `gate`), the real stops and the real LangGraph port over the memory checkpoint store. The
// body is `send → record` keyed by `orderId`, gathering `record`. The world's host counts what runs AT ONCE (each body run yields to
// the event loop before it answers, so the branches of one superstep really overlap) and keeps every effect under the ledger's own key
// form (`call:<runId>:<stepKey>:<callDigest>`): a send reaches the outside world once per ledger key. Every item sends the SAME args:
// only its identity tells its calls apart.

const NOW = "2026-11-12T08:00:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-fanout" }
const SEND_ARGS = { conversationId: "conv-1", text: "Nhac thanh toan" }

const node = (key: string, step: string, more: Partial<GraphSpecNode> = {}): GraphSpecNode => ({ key, kind: "execute", step, ...more })

/** The list, a loop over it (`concurrency` as given; absent: the sequential cycle), a body `send → record`, a step after the loop. */
const specOf = (concurrency: number | null, itemKey = "orderId"): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [TOOL.customerMessageSend] },
    nodes: [
        node("list", "spec.list", { next: "each" }),
        node("each", "core.for-each", {
            params: { max: LOOP_MAX, collect: "record", itemKey, ...(concurrency === null ? {} : { concurrency }) },
            routes: { body: "send" },
            next: "after",
        }),
        node("send", "spec.send", { next: "record" }),
        node("record", "spec.record"),
        node("after", "spec.after"),
    ],
})

const NODE_IDS = ["spec.list", "core.for-each", "spec.send", "spec.record", "spec.after"]

const ordersOf = (count: number): ReadonlyArray<Readonly<Record<string, string>>> =>
    Array.from({ length: count }, (_item, at) => ({ orderId: `o-${String(at + 1)}`, customerId: "c-1" }))

/** Lets the other branches of the superstep run before this one answers. */
const yieldTurns = async (turns: number): Promise<void> => {
    for (let turn = 0; turn < turns; turn += 1) await new Promise<void>((resolve) => setImmediate(resolve))
}

@Module({})
class LoopFanoutWorldModule {}

/** What a case changes: the list, the loop's concurrency, the step keys whose node fails once, the step key killed once before it runs. */
interface World {
    items: ReadonlyArray<unknown>
    concurrency: number | null
    failAt?: Set<string>
    killAt?: string | null
    /** The loop's `itemKey`; absent: `orderId`. */
    itemKey?: string
}

const build = async (world: World) => {
    const flow = specOf(world.concurrency, world.itemKey)
    const stops = new Map<string, RunStop>()
    const ran: Array<string> = []
    const sent: Array<string> = []
    const ledger = new Map<string, string>()
    /** The body runs in flight now, the most ever, and the items whose body has started but not yet ended. */
    const live = { now: 0, most: 0, items: new Set<string>(), mostItems: 0 }
    const host = mock<GraphNodeHostService>()
    host.run.mockImplementation(async (input: NodeRunInput) => {
        const stepKey = input.key.slice(`${REF.runId}:`.length)
        ran.push(stepKey)
        const item: unknown = Reflect.get(Object(input.input), "item")
        const orderId =
            typeof item === "string" ? item : typeof item === "object" && item !== null ? String(Reflect.get(item, "orderId")) : ""
        if (input.nodeId === "spec.list") return { output: { orders: world.items }, effects: [] }
        if (input.nodeId === "core.for-each") return { output: { items: [], held: null, results: [] }, effects: [] }
        if (input.nodeId === "spec.after") return { output: { done: true }, effects: [] }
        live.now += 1
        live.most = Math.max(live.most, live.now)
        live.items.add(orderId)
        live.mostItems = Math.max(live.mostItems, live.items.size)
        // Later items answer sooner: completion order is not list order.
        const index = Number(orderId.slice(2))
        await yieldTurns(Number.isFinite(index) ? 12 - (index % 10) : 1)
        live.now -= 1
        if (input.nodeId === "spec.send") {
            const key = `call:${input.key}:${callDigestOf(TOOL.customerMessageSend, SEND_ARGS)}`
            if (!ledger.has(key)) {
                sent.push(stepKey)
                ledger.set(key, stepKey)
            }
            return { output: { messageId: `m-${orderId}` }, effects: [] }
        }
        if (world.failAt?.has(stepKey) === true) {
            world.failAt.delete(stepKey)
            live.items.delete(orderId)
            return { code: "SPEC_RECORD_FAILED", text: "the sheet was unreachable" } as never
        }
        live.items.delete(orderId)
        return { output: { recorded: orderId }, effects: [] }
    })
    const memory = mock<AgentGraphStepMemoryService>()
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
    // The stops of the run, one per step key: a window may hold several items, each with its own stop.
    const records = mock<RunStopRecordsService>({
        open: jest.fn((input: StopOpen) => {
            const kept = stops.get(input.stepKey)
            const stop: RunStop = {
                id: kept?.id ?? `stop-${String(stops.size + 1)}`,
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
                cardMessageId: kept?.cardMessageId ?? null,
                customerLines: [],
                answers: kept?.answers ?? [],
                decision: null,
                repeats: (kept?.repeats ?? 0) + 1,
                stoppedAt: NOW,
                resolvedAt: null,
            }
            stops.set(input.stepKey, stop)
            return Promise.resolve(stop)
        }),
        byRunStep: jest.fn((_ws: string, _run: string, stepKey: string) => Promise.resolve(stops.get(stepKey) ?? null)),
        ofRun: jest.fn(() => Promise.resolve([...stops.values()])),
        patch: jest.fn((_ws: string, id: string, change: StopBuild) => {
            const stop = [...stops.values()].find((one) => one.id === id)
            if (stop === undefined) return Promise.resolve(null)
            const values = change(stop)
            if (values === null) return Promise.resolve(null)
            const next = { ...stop, ...values }
            stops.set(stop.stepKey, next)
            return Promise.resolve(next)
        }),
    })
    const core = mock<AgentGraphAiCoreService>({ decide: jest.fn().mockResolvedValue(null) })
    const definitions = new Map(NODE_IDS.map((id) => [id, { effects: [], title: { vi: id, en: id } }]))
    const providers = [
        { provide: CHECKPOINT_STORE, useValue: memoryCheckpointStore().port },
        { provide: LOGGER, useValue: mock<Logger>() },
    ]
    const globals: DynamicModule = { module: LoopFanoutWorldModule, global: true, providers, exports: providers.map((one) => one.provide) }
    const moduleRef = await Test.createTestingModule({
        imports: [globals, LanggraphModule.register({ isGlobal: true, compiledMax: 5, stepLimit: 400 })],
        providers: [
            ThreadStepService,
            RunStopsService,
            { provide: RunStopRecordsService, useValue: records },
            { provide: GraphNodeEffectsService, useValue: mock<GraphNodeEffectsService>({ recordsOf: jest.fn().mockResolvedValue([]) }) },
            {
                provide: StopCardsService,
                useValue: mock<StopCardsService>({
                    posted: jest.fn().mockResolvedValue("msg-1"),
                    resolved: jest.fn().mockResolvedValue(undefined),
                    rewritten: jest.fn().mockResolvedValue(undefined),
                }),
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
    const compiled = compileTemplate(
        {
            pin: { versionId: "v-fanout", workflowId: null, number: 1, documentHash: null, templateId: null, templateVersion: null },
            spec: flow,
        },
        new Set(NODE_IDS),
        { loops: true },
    )
    if (compiled.kind === "refused") throw new Error(JSON.stringify(compiled.problems))
    const run = { agentId: "agent-1", versionId: "v-fanout", flow, namespace: "sales.round", workflowId: null, replay: threads.replayPortsOf }
    const graph: ThreadGraph = {
        version: "v-fanout",
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
    return { threads, graph, ran, sent, ledger, live, core, stops, records }
}

const itemSteps = (orderId: string): ReadonlyArray<string> => [`each[${orderId}].send`, `each[${orderId}].record`]
const timesOf = (ran: ReadonlyArray<string>, stepKey: string): number => ran.filter((one) => one === stepKey).length
const loopOutputOf = (state: ThreadState | null): unknown => {
    const step: unknown = state?.steps.each
    return typeof step === "object" && step !== null ? Reflect.get(step, "output") : undefined
}
const keysOf = (count: number): ReadonlyArray<string> => ordersOf(count).map((order) => order.orderId ?? "")
const RETRY = { kind: "retry", by: "user-owner", at: NOW }

describe("loop over as a LangGraph Send fan-out: windows of `concurrency` items, joined by a reducer, items independent", () => {
    it("7 items, concurrency 3: at most 3 body runs at once (3 reached), every item once, gathered in LIST order", async () => {
        const { threads, graph, ran, sent, ledger, live } = await build({ items: ordersOf(7), concurrency: 3 })

        const outcome = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(outcome.status).toBe("ended")
        expect(live.most).toBe(3)
        expect(live.mostItems).toBe(3)
        for (const key of keysOf(7)) for (const stepKey of itemSteps(key)) expect(timesOf(ran, stepKey)).toBe(1)
        expect(sent).toHaveLength(7)
        expect(ledger.size).toBe(7)
        expect(ran.at(-1)).toBe("after")
        // The windows ran in order: no item of window 2 began before every item of window 1 had ended.
        const firstOfWindow2 = ran.findIndex((one) => one.startsWith("each[o-4]"))
        expect(Math.max(...keysOf(3).map((key) => ran.lastIndexOf(`each[${key}].record`)))).toBeLessThan(firstOfWindow2)
        const output = loopOutputOf(outcome.status === "ended" ? outcome.state : null)
        expect(output).toEqual({
            items: keysOf(7).map((key) => ({ key, output: { recorded: key } })),
            held: null,
            results: keysOf(7).map((key) => ({ recorded: key })),
        })
        // The fan-out leaves nothing behind it: no frame, no branch record.
        expect(outcome.status === "ended" ? outcome.state.loop : "x").toBeNull()
        expect(outcome.status === "ended" ? outcome.state.branches : "x").toBeUndefined()
    })

    it("item 4's record fails: items 5 and 6 of its window end, the run stops once; the retry runs ONLY item 4's record, then item 7", async () => {
        const { threads, graph, ran, sent, ledger, stops } = await build({
            items: ordersOf(7),
            concurrency: 3,
            failAt: new Set(["each[o-4].record"]),
        })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(stopped.status).toBe("stopped")
        expect([...stops.keys()]).toEqual(["each[o-4].record"])
        for (const key of ["o-1", "o-2", "o-3", "o-5", "o-6"]) expect(timesOf(ran, `each[${key}].record`)).toBe(1)
        expect(timesOf(ran, "each[o-4].send")).toBe(1)
        expect(ran.some((one) => one.startsWith("each[o-7]"))).toBe(false)
        const before = ran.length

        const resumed = await threads.resume(REF, graph, RETRY)

        expect(resumed.status).toBe("ended")
        expect(ran.slice(before)).toEqual(["each[o-4].record", ...itemSteps("o-7"), "after"])
        expect(timesOf(ran, "each[o-4].send")).toBe(1)
        expect(sent.toSorted()).toEqual(keysOf(7).map((key) => `each[${key}].send`).toSorted())
        expect([...ledger.values()].filter((stepKey) => stepKey === "each[o-4].send")).toHaveLength(1)
        expect(stops.get("each[o-4].record")?.state).toBe("resolved")
        const output = loopOutputOf(resumed.status === "ended" ? resumed.state : null)
        expect(Reflect.get(Object(output), "items")).toEqual(keysOf(7).map((key) => ({ key, output: { recorded: key } })))
    })

    it("two items of one window fail: ONE gate for both (each its own stop), the founder's one retry runs both failed nodes and nothing else", async () => {
        const { threads, graph, ran, stops } = await build({
            items: ordersOf(6),
            concurrency: 3,
            failAt: new Set(["each[o-4].record", "each[o-6].record"]),
        })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(stopped.status).toBe("stopped")
        expect(stopped.status === "stopped" ? stopped.state.trouble : null).toMatchObject({
            stepKey: "each[o-4].record",
            nodeKey: "each",
            held: ["each[o-4].record", "each[o-6].record"],
        })
        expect([...stops.keys()].toSorted()).toEqual(["each[o-4].record", "each[o-6].record"])
        const before = ran.length

        const resumed = await threads.resume(REF, graph, RETRY)

        expect(resumed.status).toBe("ended")
        expect(ran.slice(before).toSorted()).toEqual(["after", "each[o-4].record", "each[o-6].record"])
        // The one decision is kept on both stops, and both resolve when their step completes.
        for (const stepKey of ["each[o-4].record", "each[o-6].record"]) {
            expect(stops.get(stepKey)?.answers.map((answer) => answer.kind)).toEqual(["retry"])
            expect(stops.get(stepKey)?.state).toBe("resolved")
        }
    })

    it("a kill inside a window, then a restart: no item acts twice (one ledger row per item), no item of an earlier window runs again", async () => {
        // The kill hits item 5's send while items 4 and 6 are sending in the same superstep.
        const { threads, graph, ran, sent, ledger } = await build({ items: ordersOf(7), concurrency: 3, killAt: "each[o-5].send" })

        await expect(threads.start(REF, graph, { trigger: { locale: "vi" } })).rejects.toThrow("killed at each[o-5].send")
        expect(ran.some((one) => one.startsWith("each[o-7]"))).toBe(false)
        expect(ran).not.toContain("each[o-5].send")

        const outcome = await threads.drive(REF, graph)

        expect(outcome.status).toBe("ended")
        // The windows before the kill never run again: their writes are in the checkpoint.
        for (const key of keysOf(3)) for (const stepKey of itemSteps(key)) expect(timesOf(ran, stepKey)).toBe(1)
        // LangGraph re-runs every task of the killed superstep that had not finished (items 4 and 6 were mid-send): the ledger
        // answers their second run, so each item reached the outside world once.
        expect(timesOf(ran, "each[o-5].send")).toBe(1)
        for (const key of ["o-4", "o-6"]) expect(timesOf(ran, `each[${key}].send`)).toBeLessThanOrEqual(2)
        expect(sent.toSorted()).toEqual(keysOf(7).map((key) => `each[${key}].send`).toSorted())
        expect(new Set(ledger.values()).size).toBe(7)
        expect(ledger.size).toBe(7)
        const output = loopOutputOf(outcome.status === "ended" ? outcome.state : null)
        expect(Reflect.get(Object(output), "items")).toEqual(keysOf(7).map((key) => ({ key, output: { recorded: key } })))
    })

    it("52 items, concurrency 5: 50 run, 2 held (count and first key); the checkpoint stays under its ceiling", async () => {
        const { threads, graph, ran, sent, live } = await build({ items: ordersOf(52), concurrency: 5 })

        const outcome = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(outcome.status).toBe("ended")
        const state = outcome.status === "ended" ? outcome.state : null
        const output = loopOutputOf(state)
        expect(output).toMatchObject({ held: { count: 2, firstKey: "o-51" } })
        expect(Reflect.get(Object(output), "items")).toHaveLength(LOOP_MAX)
        expect(sent).toHaveLength(LOOP_MAX)
        expect(live.most).toBe(5)
        expect(ran.some((one) => one.startsWith("each[o-51]") || one.startsWith("each[o-52]"))).toBe(false)
        expect(Buffer.byteLength(JSON.stringify(state), "utf8")).toBeLessThan(DEFAULT_CHECKPOINT_LIMITS.maxBytes)
    })

    it("a list where two items share an orderId stops before ANY item runs", async () => {
        const items = [{ orderId: "o-1" }, { orderId: "o-2" }, { orderId: "o-1" }]
        const { threads, graph, ran, sent, stops, core } = await build({ items, concurrency: 3 })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(stopped.status).toBe("stopped")
        expect(ran).toEqual(["list", "each"])
        expect(sent).toEqual([])
        expect(stops.get("each")).toMatchObject({ kind: "engine" })
        expect(JSON.stringify(stops.get("each")?.detail.facts)).toContain(FOREACH_ITEM_KEY_DUPLICATE)
        expect(core.decide).not.toHaveBeenCalled()
    })

    it("concurrency 1 is today's sequential cycle, step for step: a freeze in item 2 does not start item 3", async () => {
        const sequential = await build({ items: ordersOf(3), concurrency: null, failAt: new Set(["each[o-2].record"]) })
        const one = await build({ items: ordersOf(3), concurrency: 1, failAt: new Set(["each[o-2].record"]) })

        for (const world of [sequential, one]) {
            const stopped = await world.threads.start(REF, world.graph, { trigger: { locale: "vi" } })
            expect(stopped.status).toBe("stopped")
            expect(world.ran).toEqual(["list", "each", ...itemSteps("o-1"), ...itemSteps("o-2")])
            expect(world.live.most).toBe(1)
            const resumed = await world.threads.resume(REF, world.graph, RETRY)
            expect(resumed.status).toBe("ended")
        }
        expect(one.ran).toEqual(sequential.ran)
    })
})

describe('a fan-out over plain values keyed by the value itself ("."), and a list re-ordered between the failure and the retry', () => {
    const CODES = ["web-basic", "seo", "hosting", "mail", "ssl"]

    it("concurrency 3: every body step is keyed by its value; the retry runs only the failed item's node; the re-ordered list is never read", async () => {
        const world: World = { items: CODES, concurrency: 3, itemKey: LOOP_ITEM_SELF_KEY, failAt: new Set(["each[seo].record"]) }
        const { threads, graph, ran, sent, ledger } = await build(world)

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })
        expect(stopped.status).toBe("stopped")
        for (const code of ["web-basic", "hosting"]) expect(timesOf(ran, `each[${code}].record`)).toBe(1)
        const before = ran.length
        // The list the loop was handed changes order after the failure: the fan-out goes on over the list it recorded.
        world.items = [...CODES].reverse()

        const resumed = await threads.resume(REF, graph, RETRY)

        expect(resumed.status).toBe("ended")
        expect(timesOf(ran, "each")).toBe(1)
        expect(ran.slice(before, before + 1)).toEqual(["each[seo].record"])
        expect(ran.slice(before + 1, -1).toSorted()).toEqual([...itemSteps("mail"), ...itemSteps("ssl")].toSorted())
        expect(sent.toSorted()).toEqual(CODES.map((code) => `each[${code}].send`).toSorted())
        expect(ledger.size).toBe(CODES.length)
        const output = loopOutputOf(resumed.status === "ended" ? resumed.state : null)
        expect(Reflect.get(Object(output), "items")).toEqual(CODES.map((code) => ({ key: code, output: { recorded: code } })))
    })

    it("two equal values stop the loop node before ANY item runs", async () => {
        const { threads, graph, ran, sent, stops } = await build({ items: ["seo", "web", "seo"], concurrency: 3, itemKey: LOOP_ITEM_SELF_KEY })

        const stopped = await threads.start(REF, graph, { trigger: { locale: "vi" } })

        expect(stopped.status).toBe("stopped")
        expect(ran).toEqual(["list", "each"])
        expect(sent).toEqual([])
        expect(JSON.stringify(stops.get("each")?.detail.facts)).toContain(FOREACH_ITEM_KEY_DUPLICATE)
    })
})
