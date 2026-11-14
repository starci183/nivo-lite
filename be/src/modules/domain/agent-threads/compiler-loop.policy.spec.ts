import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOOP_CONCURRENCY_CAP, LOOP_ITEM_SELF_KEY, type GraphSpec, type GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { CHECKPOINT_STORE, GRAPH_THREADS, LanggraphModule, THREAD_END } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadGraph, ThreadGraphNode, ThreadNodeAnswer, ThreadState } from "@modules/integrations/langgraph"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { memoryCheckpointStore } from "@tests/fixtures/builders/checkpoint-store.builder"
import { FOREACH_ITEM_KEY_DUPLICATE, FOREACH_ITEM_KEY_MISSING, LOOP_MAX } from "@nivo-lite/agent-sdk/node"
import {
    boundedItemKeyOf,
    iterationEnded,
    iterationInputOf,
    iterationPicked,
    loopFrameOf,
    loopListingOf,
    loopSettingsOf,
    loopStarted,
    loopStepKeyOf,
    loopSummaryOf,
    loopVisitOf,
    branchGatheredOf,
    fanoutStarted,
    fanoutVisitOf,
    isFanoutLoop,
    itemBranchIdOf,
    loopBranchOf,
} from "./compiler-loop.policy"
import type { LoopList, ThreadLoopFrame } from "./compiler-loop.policy"
import { FREEZE_NODE, compileTemplate, stepExitOf } from "./template-compiler.policy"
import type { CompiledStep, CompiledTemplate, TemplatePin } from "./template-compiler.policy"

// Package W6 (design row 2-1): a for-each on a thread is a sequential cycle. The compiler draws it, the policy moves the frame, and the
// real LangGraph port drives it: one iteration at a time, a re-drive after a crash goes on in the iteration it was in.

const PIN: TemplatePin = {
    versionId: "version-loop",
    workflowId: null,
    number: 1,
    documentHash: null,
    templateId: null,
    templateVersion: null,
}

const node = (key: string, step: string, more: Partial<GraphSpecNode> = {}): GraphSpecNode => ({
    key,
    kind: "execute",
    step,
    ...more,
})

/** A list, a for-each over it whose body prices then notes each element, and a step after the loop. */
const LOOP_SPEC: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [] },
    nodes: [
        node("list", "spec.list", { next: "each" }),
        node("each", "core.for-each", { routes: { body: "price" }, next: "after" }),
        node("price", "spec.price", { next: "note" }),
        node("note", "spec.note", { routes: { skip: "done" } }),
        node("done", "stop"),
        node("after", "spec.after"),
    ],
}

const INSTALLED: ReadonlySet<string> = new Set(["spec.list", "core.for-each", "spec.price", "spec.note", "spec.after"])

const compiledOf = (spec: GraphSpec, loops = true): CompiledTemplate | ReadonlyArray<unknown> => {
    const result = compileTemplate({ pin: PIN, spec }, INSTALLED, { loops })
    return result.kind === "compiled" ? result.graph : result.problems
}

const graphOf = (spec: GraphSpec): CompiledTemplate => {
    const result = compileTemplate({ pin: PIN, spec }, INSTALLED, { loops: true })
    if (result.kind === "refused") throw new Error(JSON.stringify(result.problems))
    return result.graph
}

const stepNamed = (graph: CompiledTemplate, key: string): CompiledStep | undefined =>
    graph.nodes.find((candidate) => candidate.key === key)

const frameOf = (index: number, items: ReadonlyArray<unknown>, more: Partial<ThreadLoopFrame> = {}): ThreadLoopFrame => ({
    nodeKey: "each",
    index,
    items,
    keys: items.map((_item, at) => String(at)),
    collect: null,
    held: null,
    joins: [],
    picked: null,
    ended: null,
    ...more,
})

/** A list keyed by index, nothing held, nothing collected. */
const listOf = (items: ReadonlyArray<unknown>, more: Partial<LoopList> = {}): LoopList => ({
    items,
    keys: items.map((_item, at) => String(at)),
    held: null,
    collect: null,
    ...more,
})

describe("compileTemplate with loops: a for-each is a sequential cycle", () => {
    it("sends the loop to its body and to its own exit, and every way out of the body back to the loop", () => {
        const graph = graphOf(LOOP_SPEC)

        expect(stepNamed(graph, "each")).toMatchObject({
            loop: { body: "price" },
            exit: { kind: "next", to: "after" },
            ends: ["price", "after", FREEZE_NODE],
        })
        expect(stepNamed(graph, "each")?.inLoop).toBeUndefined()
        expect(stepNamed(graph, "price")).toMatchObject({ inLoop: "each", exit: { kind: "next", to: "note" } })
        // The note branches: `skip` to a stop node and any other branch end the iteration, never the thread.
        expect(stepNamed(graph, "note")).toMatchObject({
            inLoop: "each",
            exit: { kind: "branch", routes: { skip: "each" }, otherwise: "each" },
            ends: ["each", FREEZE_NODE],
        })
        expect(stepNamed(graph, "after")).toMatchObject({ exit: { kind: "next", to: THREAD_END } })
        expect(stepNamed(graph, "after")?.inLoop).toBeUndefined()
    })

    it("still refuses a for-each without the loops option, for an engine that does not drive a frame", () => {
        expect(compiledOf(LOOP_SPEC, false)).toEqual([{ code: "TEMPLATE_LOOP_PHASE_2", at: "each" }])
    })

    it("draws a loop with an empty body as a node that sums at once and follows its exit", () => {
        const nodes = LOOP_SPEC.nodes
            .filter((one) => one.key !== "price" && one.key !== "note")
            .map((one) => (one.key === "each" ? { ...one, routes: { body: "done" } } : one))
        const spec = { ...LOOP_SPEC, nodes }
        const graph = graphOf(spec)

        expect(stepNamed(graph, "each")).toMatchObject({ loop: { body: null }, ends: ["after", FREEZE_NODE] })
        expect(loopStarted("each", null, listOf([1, 2]))).toEqual({
            kind: "summed",
            output: {
                items: [
                    { key: "0", output: null },
                    { key: "1", output: null },
                ],
                held: null,
                results: [null, null],
            },
        })
    })

    it("refuses a loop inside a loop's body, by name", () => {
        const nodes = LOOP_SPEC.nodes.map((one) =>
            one.key === "price" ? { ...one, next: "inner" } : one.key === "note" ? { ...one, routes: {} } : one,
        )
        const spec = { ...LOOP_SPEC, nodes: [...nodes, node("inner", "core.for-each", { routes: { body: "note" } })] }

        expect(compiledOf(spec)).toEqual(expect.arrayContaining([{ code: "TEMPLATE_LOOP_NESTED", at: "inner" }]))
    })

    it("refuses a body node a node outside the loop also leads to: its end would go back to the loop", () => {
        const nodes = LOOP_SPEC.nodes.map((one) => (one.key === "list" ? { ...one, routes: { many: "each", one: "note" } } : one))

        expect(compiledOf({ ...LOOP_SPEC, nodes })).toEqual([{ code: "TEMPLATE_LOOP_SHARED", at: "note" }])
    })
})

describe("the list a loop runs: identities, the cap, the settings", () => {
    it("reads its settings from the params as the graph wrote them, @1 (none) or @2 (collect, itemKey, max)", () => {
        const none = { max: LOOP_MAX, collect: null, itemKey: null, concurrency: 1 }
        expect(loopSettingsOf(undefined)).toEqual(none)
        expect(loopSettingsOf({ items: { $ref: "steps.list.output.orders" } })).toEqual(none)
        expect(loopSettingsOf({ max: 3, collect: "record", itemKey: "orderId" })).toEqual({ ...none, max: 3, collect: "record", itemKey: "orderId" })
        expect(loopSettingsOf({ max: 500 }).max).toBe(LOOP_MAX)
        expect(loopSettingsOf({ max: 0, collect: "", itemKey: { $ref: "x" } })).toEqual({ ...none, max: 1 })
    })

    it("reads `concurrency` within 1 and the cap (5): absent or not a whole number is 1, the sequential cycle", () => {
        expect(loopSettingsOf({ concurrency: 3 }).concurrency).toBe(3)
        expect(loopSettingsOf({ concurrency: 9 }).concurrency).toBe(LOOP_CONCURRENCY_CAP)
        expect(loopSettingsOf({ concurrency: 0 }).concurrency).toBe(1)
        expect(loopSettingsOf({ concurrency: 2.5 }).concurrency).toBe(1)
        expect(isFanoutLoop({ concurrency: 2 })).toBe(true)
        expect(isFanoutLoop({ concurrency: 1 })).toBe(false)
        expect(isFanoutLoop({})).toBe(false)
    })

    it("keys each item by its index when no itemKey is declared", () => {
        expect(loopListingOf(["a", "a", "b"], loopSettingsOf({}))).toEqual({ kind: "listed", ...listOf(["a", "a", "b"]) })
    })

    it("keys each item by the declared member (a text or a number, at a dotted path)", () => {
        const items = [{ orderId: "o-1" }, { orderId: 7 }, { order: { id: "x" }, orderId: "o-3" }]
        expect(loopListingOf(items, loopSettingsOf({ itemKey: "orderId" }))).toMatchObject({ kind: "listed", keys: ["o-1", "7", "o-3"] })
        expect(loopListingOf([{ order: { id: "x" } }], loopSettingsOf({ itemKey: "order.id" }))).toMatchObject({ keys: ["x"] })
    })

    it("bounds an identity: longer than 64 characters, or with a character a step key cannot carry, it is a digest", () => {
        const long = "x".repeat(65)
        expect(boundedItemKeyOf("x".repeat(64))).toBe("x".repeat(64))
        expect(boundedItemKeyOf(long)).toMatch(/^sha-[0-9a-f]{40}$/u)
        expect(boundedItemKeyOf(long)).toBe(boundedItemKeyOf(long))
        expect(boundedItemKeyOf("a:b")).toMatch(/^sha-/u)
        expect(boundedItemKeyOf("Hoa h\u1ed3ng")).toMatch(/^sha-/u)
        expect(boundedItemKeyOf("INV-2026/001")).toBe("INV-2026/001")
    })

    it("refuses a list where two items share an identity, before any item runs, naming both", () => {
        const listing = loopListingOf([{ orderId: "a" }, { orderId: "b" }, { orderId: "a" }], loopSettingsOf({ itemKey: "orderId" }))
        expect(listing).toMatchObject({ kind: "refused", code: FOREACH_ITEM_KEY_DUPLICATE, index: 2 })
        expect(listing.kind === "refused" ? listing.text : "").toContain("item 0")
        // Two raw ids that bound to the same identity are the same identity: never two items under one key.
        expect(loopListingOf([{ id: 1 }, { id: "1" }], loopSettingsOf({ itemKey: "id" }))).toMatchObject({ code: FOREACH_ITEM_KEY_DUPLICATE })
    })

    it("refuses a list where an item has no identity under the declared itemKey", () => {
        expect(loopListingOf([{ orderId: "a" }, { other: 1 }], loopSettingsOf({ itemKey: "orderId" }))).toMatchObject({
            kind: "refused",
            code: FOREACH_ITEM_KEY_MISSING,
            index: 1,
        })
        expect(loopListingOf(["a"], loopSettingsOf({ itemKey: "orderId" }))).toMatchObject({ code: FOREACH_ITEM_KEY_MISSING })
    })

    it('keys a list of plain values by the value itself under "." (texts as they are, numbers as their decimal text), bounded alike', () => {
        const self = loopSettingsOf({ itemKey: LOOP_ITEM_SELF_KEY })
        expect(self.itemKey).toBe(".")
        expect(loopListingOf(["web-basic", "seo", "hosting"], self)).toMatchObject({ kind: "listed", keys: ["web-basic", "seo", "hosting"] })
        expect(loopListingOf([7, 2.5, -1], self)).toMatchObject({ kind: "listed", keys: ["7", "2.5", "-1"] })
        // The same value keys the same item wherever it stands in the list: the key never depends on the order.
        const ordered = loopListingOf(["a", "b", "c"], self)
        const reordered = loopListingOf(["c", "a", "b"], self)
        expect(reordered).toMatchObject({ keys: ["c", "a", "b"], items: ["c", "a", "b"] })
        expect(ordered).toMatchObject({ keys: ["a", "b", "c"] })
        // The existing bound applies unchanged: longer than 64 characters, or holding `[`, `]`, `:`, a digest.
        expect(loopListingOf(["x".repeat(65), "svc:1", "[a]"], self)).toMatchObject({
            keys: [boundedItemKeyOf("x".repeat(65)), boundedItemKeyOf("svc:1"), boundedItemKeyOf("[a]")],
        })
        expect(loopListingOf(["svc:1"], self)).toMatchObject({ keys: [expect.stringMatching(/^sha-[0-9a-f]{40}$/u)] })
        expect(loopListingOf(["a", "b", "c"], { ...self, max: 2 })).toMatchObject({ held: { count: 1, firstKey: "c" } })
    })

    it('refuses under "." a repeated value before any item runs, and an item that is no text or number (an engine stop)', () => {
        const self = loopSettingsOf({ itemKey: LOOP_ITEM_SELF_KEY })
        const repeated = loopListingOf(["seo", "web", "seo"], self)
        expect(repeated).toMatchObject({ kind: "refused", code: FOREACH_ITEM_KEY_DUPLICATE, index: 2 })
        expect(repeated.kind === "refused" ? repeated.text : "").toContain("item 0")
        expect(loopListingOf([1, "1"], self)).toMatchObject({ code: FOREACH_ITEM_KEY_DUPLICATE, index: 1 })
        for (const item of [{ code: "seo" }, ["seo"], true, null, "", Number.NaN])
            expect(loopListingOf(["web", item], self)).toMatchObject({ kind: "refused", code: FOREACH_ITEM_KEY_MISSING, index: 1 })
    })

    it("runs the first max items and counts the rest as held, with the first held item's identity", () => {
        const items = Array.from({ length: 52 }, (_item, at) => ({ id: `n${String(at)}` }))
        const listing = loopListingOf(items, loopSettingsOf({ itemKey: "id" }))
        expect(listing.kind === "listed" ? listing.items.length : 0).toBe(LOOP_MAX)
        expect(listing).toMatchObject({ kind: "listed", held: { count: 2, firstKey: "n50" } })
        expect(loopListingOf(["a", "b", "c"], loopSettingsOf({ max: 2 }))).toMatchObject({ held: { count: 1, firstKey: "2" } })
    })
})

describe("the moves of a loop's frame", () => {
    it("starts the first iteration at the body with a fresh frame, and sums at once an empty list", () => {
        expect(loopStarted("each", "price", listOf(["a", "b"]))).toEqual({ kind: "iterate", frame: frameOf(0, ["a", "b"]), goto: "price" })
        expect(loopStarted("each", "price", listOf([]))).toEqual({ kind: "summed", output: { items: [], held: null, results: [] } })
    })

    it("starts on a visit with no ended iteration of its own, and joins one that ended", () => {
        expect(loopVisitOf("each", "price", null)).toEqual({ kind: "start" })
        expect(loopVisitOf("each", "price", frameOf(0, ["a"]))).toEqual({ kind: "start" })
        expect(loopVisitOf("each", "price", { ...frameOf(0, ["a"]), nodeKey: "other" })).toEqual({ kind: "start" })

        const ended = iterationEnded(frameOf(0, ["a", "b"]), { price: 1 })
        expect(loopVisitOf("each", "price", ended)).toEqual({
            kind: "join",
            move: {
                kind: "iterate",
                frame: frameOf(1, ["a", "b"], { joins: [{ index: 0, key: "0", output: { price: 1 } }] }),
                goto: "price",
            },
        })
    })

    it("sums after the last iteration: each item's identity and gathered output in order, and the held part", () => {
        const held = { count: 2, firstKey: "z" }
        const last = iterationEnded(
            frameOf(1, ["a", "b"], { keys: ["ka", "kb"], held, joins: [{ index: 0, key: "ka", output: { price: 1 } }] }),
            { price: 2 },
        )

        expect(loopVisitOf("each", "price", last)).toEqual({
            kind: "join",
            move: {
                kind: "summed",
                output: {
                    items: [
                        { key: "ka", output: { price: 1 } },
                        { key: "kb", output: { price: 2 } },
                    ],
                    held,
                    results: [{ price: 1 }, { price: 2 }],
                },
            },
        })
    })

    it("gathers the collect node's output, not the node the iteration ended on; null when the item's route never reached it", () => {
        const frame = frameOf(0, ["a", "b"], { collect: "record" })
        const recorded = iterationPicked(iterationPicked(frame, "send", { sent: "a" }), "record", { kept: "a" })
        expect(recorded.picked).toEqual({ index: 0, output: { kept: "a" } })
        const first = iterationEnded(recorded, { told: "team" })
        expect(first.ended).toEqual({ index: 0, key: "0", output: { kept: "a" } })
        const second = loopVisitOf("each", "send", first)
        const next = second.kind === "join" && second.move.kind === "iterate" ? second.move.frame : frame
        // The next item starts with nothing picked: its route skips `record`, so it gathers null, never item 0's output.
        expect(next.picked).toBeNull()
        const skipped = loopVisitOf("each", "send", iterationEnded(next, { told: "team" }))
        expect(skipped.kind === "join" && skipped.move.kind === "summed" ? skipped.move.output.items : null).toEqual([
            { key: "0", output: { kept: "a" } },
            { key: "1", output: null },
        ])
    })

    it("joins an iteration once, even when its end is seen twice", () => {
        const twice = iterationEnded(frameOf(0, ["a"], { joins: [{ index: 0, key: "0", output: 1 }] }), 2)

        expect(loopVisitOf("each", "price", twice)).toEqual({
            kind: "join",
            move: { kind: "summed", output: loopSummaryOf(frameOf(0, ["a"]), [{ index: 0, key: "0", output: 2 }]) },
        })
    })

    it("reads back a frame stored as JSON, a frame written before identities by index, and nothing that is no frame", () => {
        const frame = iterationEnded(
            frameOf(1, [{ id: 1 }, null], {
                keys: ["k1", "k2"],
                collect: "record",
                held: { count: 1, firstKey: "k3" },
                picked: { index: 1, output: "x" },
                joins: [{ index: 0, key: "k1", output: null }],
            }),
            "x",
        )

        expect(loopFrameOf(structuredClone(frame))).toEqual(frame)
        expect(loopFrameOf({ nodeKey: "each", index: 0, items: ["a"], joins: [{ index: 0, output: 1 }], ended: null })).toEqual(
            frameOf(0, ["a"], { joins: [{ index: 0, key: "0", output: 1 }] }),
        )
        expect(loopFrameOf(null)).toBeNull()
        expect(loopFrameOf({ index: 0 })).toBeNull()
        expect(loopFrameOf([])).toBeNull()
    })

    it("runs a body node under the key of its loop and item, and every other node under its own key", () => {
        const frame = frameOf(2, ["a", "b", "c"], { keys: ["o-1", "o-2", "o-3"] })
        expect(loopStepKeyOf("price", "each", frame)).toBe("each[o-3].price")
        expect(loopStepKeyOf("price", "each", null)).toBe("price")
        expect(loopStepKeyOf("after", undefined, frame)).toBe("after")
        expect(iterationInputOf(frameOf(1, ["a", "b"]))).toEqual({
            item: { value: "b", index: 1, key: "1" },
            loop: { nodeKey: "each", index: 1, items: ["a", "b"] },
        })
    })
})

@Module({})
class LoopWorldModule {}

/** The real LangGraph threads port over the checkpoint store in memory (the store and the logger as the app's globals). */
const threadsOf = async (): Promise<GraphThreads> => {
    const providers = [
        { provide: CHECKPOINT_STORE, useValue: memoryCheckpointStore().port },
        { provide: LOGGER, useValue: mock<Logger>() },
    ]
    const world: DynamicModule = {
        module: LoopWorldModule,
        global: true,
        providers,
        exports: providers.map((one) => one.provide),
    }
    const moduleRef = await Test.createTestingModule({
        imports: [world, LanggraphModule.register({ isGlobal: true, compiledMax: 5, stepLimit: 200 })],
    }).compile()
    return moduleRef.get<GraphThreads>(GRAPH_THREADS)
}

/** The list the `list` step answered. */
const itemsOf = (output: unknown): ReadonlyArray<unknown> => {
    const items: unknown = typeof output === "object" && output !== null ? Reflect.get(output, "items") : undefined
    return Array.isArray(items) ? items : []
}

/** What the spec's node function saw: each step key it ran, in order. */
interface Driven {
    readonly ran: Array<string>
    /** Throws once at this step key. */
    crashAt: string | null
}

/**
 * The thread graph of a compiled loop with a node function that does what the engine's does with a loop: the loop node joins or starts,
 * a body node runs under its iteration's key with the element in scope and, leaving the body, records how the iteration ended.
 */
const threadGraphOf = (compiled: CompiledTemplate, driven: Driven): ThreadGraph => {
    const run =
        (step: CompiledStep) =>
        async (state: ThreadState): Promise<ThreadNodeAnswer> => {
            const frame = loopFrameOf(state.loop)
            const key = loopStepKeyOf(step.key, step.inLoop, frame)
            driven.ran.push(key)
            if (driven.crashAt === key) {
                driven.crashAt = null
                throw new Error(`crash at ${key}`)
            }
            if (step.loop !== undefined) {
                const visit = loopVisitOf(step.key, step.loop.body, frame)
                const items = itemsOf(state.steps.list)
                const move = visit.kind === "join" ? visit.move : loopStarted(step.key, step.loop.body, listOf(items))
                if (move.kind === "iterate") return { update: { loop: move.frame }, goto: move.goto }
                return { update: { steps: { [step.key]: move.output }, loop: null }, goto: stepExitOf(step, move.output) }
            }
            const item = frame === null ? null : iterationInputOf(frame).item?.value
            const output =
                step.key === "list" ? { items: ["rose", "lily", "tulip"] } : step.key === "price" ? { priced: item } : { noted: item }
            const goto = stepExitOf(step, output)
            const ended = step.inLoop !== undefined && goto === step.inLoop && frame !== null
            return {
                update: { steps: { [step.key]: output }, ...(ended ? { loop: iterationEnded(frame, output) } : {}) },
                goto,
            }
        }
    const freeze: ThreadGraphNode = { key: compiled.freeze.key, ends: compiled.freeze.ends, run: async () => ({ goto: THREAD_END }) }
    return {
        version: compiled.pin.versionId,
        entry: compiled.entry,
        nodes: [...compiled.nodes.map((step) => ({ key: step.key, ends: step.ends, run: run(step) })), freeze],
    }
}

describe("a for-each driven on the real LangGraph port", () => {
    const REF = { workspaceId: "ws-1", runId: "run-loop" }
    const SUMMARY = {
        items: [
            { key: "0", output: { noted: "rose" } },
            { key: "1", output: { noted: "lily" } },
            { key: "2", output: { noted: "tulip" } },
        ],
        held: null,
        results: [{ noted: "rose" }, { noted: "lily" }, { noted: "tulip" }],
    }

    it("runs the body once per element, one iteration after the other, then the loop's output and the step after it", async () => {
        const threads = await threadsOf()
        const driven: Driven = { ran: [], crashAt: null }

        const outcome = await threads.start(REF, threadGraphOf(graphOf(LOOP_SPEC), driven), { trigger: {} })

        expect(driven.ran).toEqual([
            "list",
            "each",
            "each[0].price",
            "each[0].note",
            "each",
            "each[1].price",
            "each[1].note",
            "each",
            "each[2].price",
            "each[2].note",
            "each",
            "after",
        ])
        expect(outcome.status).toBe("ended")
        expect(outcome.status === "ended" ? outcome.state.steps.each : null).toEqual(SUMMARY)
        expect(outcome.status === "ended" ? outcome.state.loop : "open").toBeNull()
    })

    it("goes on in the iteration it was in after a crash: a joined iteration never runs again", async () => {
        const threads = await threadsOf()
        const driven: Driven = { ran: [], crashAt: "each[1].note" }
        const graph = threadGraphOf(graphOf(LOOP_SPEC), driven)

        await expect(threads.start(REF, graph, { trigger: {} })).rejects.toThrow("crash at each[1].note")
        const outcome = await threads.drive(REF, graph)

        expect(driven.ran).toEqual([
            "list",
            "each",
            "each[0].price",
            "each[0].note",
            "each",
            "each[1].price",
            "each[1].note",
            "each[1].note",
            "each",
            "each[2].price",
            "each[2].note",
            "each",
            "after",
        ])
        expect(outcome.status === "ended" ? outcome.state.steps.each : null).toEqual(SUMMARY)
    })
})

describe("the fan-out of a loop (concurrency above 1): windows, joins, held items", () => {
    const list = (count: number): LoopList => ({
        items: Array.from({ length: count }, (_, at) => ({ orderId: `o-${String(at + 1)}` })),
        keys: Array.from({ length: count }, (_, at) => `o-${String(at + 1)}`),
        held: null,
        collect: "record",
    })
    const fanOf = (move: ReturnType<typeof fanoutVisitOf>) => {
        if (move.kind !== "fan") throw new Error(`expected a fan, got ${move.kind}`)
        return move
    }

    it("starts by sending the first window only, each item a branch of its own recorded as running", () => {
        const move = fanOf(fanoutStarted("each", "send", list(7), 3))
        expect(move.sends.map((one) => [one.node, one.branch.key, one.branch.index])).toEqual([
            ["send", "o-1", 0],
            ["send", "o-2", 1],
            ["send", "o-3", 2],
        ])
        expect(move.records).toEqual({
            "each[o-1]": { state: "running" },
            "each[o-2]": { state: "running" },
            "each[o-3]": { state: "running" },
        })
        expect(move.frame).toMatchObject({ nodeKey: "each", index: 0, concurrency: 3, gated: false })
        expect(loopFrameOf(JSON.parse(JSON.stringify(move.frame)))).toMatchObject({ concurrency: 3 })
    })

    it("sums at once for an empty list or a loop with no body", () => {
        expect(fanoutStarted("each", "send", list(0), 3)).toEqual({ kind: "summed", output: { items: [], held: null, results: [] } })
        expect(fanoutStarted("each", null, list(2), 3).kind).toBe("summed")
    })

    it("waits while an item of the window runs, then joins it in LIST order and sends the next window", () => {
        const { frame } = fanOf(fanoutStarted("each", "send", list(5), 2))
        const running = { "each[o-1]": { state: "ended", output: "one" }, "each[o-2]": { state: "running" } }
        expect(fanoutVisitOf("send", frame, running)).toEqual({ kind: "wait" })
        // o-2 is written first; the joins still follow the list.
        const ended = { "each[o-2]": { state: "ended", output: "two" }, "each[o-1]": { state: "ended", output: "one" } }
        const next = fanOf(fanoutVisitOf("send", frame, ended))
        expect(next.sends.map((one) => one.branch.key)).toEqual(["o-3", "o-4"])
        expect(next.frame.joins.map((join) => join.key)).toEqual(["o-1", "o-2"])
        expect(next.records).toMatchObject({ "each[o-1]": { state: "joined" }, "each[o-3]": { state: "running" } })
    })

    it("stops a window with held items at the gate ONCE, then sends each held item back to the node it stopped at", () => {
        const { frame } = fanOf(fanoutStarted("each", "send", list(3), 3))
        const trouble = { stepKey: "each[o-2].record", question: { stopId: "s" }, locale: "vi" }
        const records = {
            "each[o-1]": { state: "ended", output: "one" },
            "each[o-2]": { state: "held", nodeKey: "record", stepKey: "each[o-2].record", trouble },
            "each[o-3]": { state: "ended", output: "three" },
        }
        const gate = fanoutVisitOf("send", frame, records)
        if (gate.kind !== "gate") throw new Error(gate.kind)
        expect(gate.held).toEqual([{ index: 1, key: "o-2", nodeKey: "record", stepKey: "each[o-2].record", trouble }])
        expect(gate.frame.gated).toBe(true)
        const retry = fanOf(fanoutVisitOf("send", gate.frame, records))
        expect(retry.sends).toEqual([{ node: "record", branch: { loop: "each", index: 1, key: "o-2" } }])
        expect(retry.frame.gated).toBe(false)
    })

    it("sums once the last window ended: every item in list order, the held part kept", () => {
        const { frame } = fanOf(fanoutStarted("each", "send", { ...list(2), held: { count: 2, firstKey: "o-51" } }, 5))
        const records = { "each[o-1]": { state: "ended", output: 1 }, "each[o-2]": { state: "ended", output: null } }
        expect(fanoutVisitOf("send", frame, records)).toEqual({
            kind: "summed",
            output: {
                items: [
                    { key: "o-1", output: 1 },
                    { key: "o-2", output: null },
                ],
                held: { count: 2, firstKey: "o-51" },
                results: [1, null],
            },
        })
    })

    it("sends again from the body's start an item of the window that has no record", () => {
        const { frame } = fanOf(fanoutStarted("each", "send", list(2), 2))
        const move = fanOf(fanoutVisitOf("send", frame, { "each[o-1]": { state: "ended", output: 1 } }))
        expect(move.sends).toEqual([{ node: "send", branch: { loop: "each", index: 1, key: "o-2" } }])
    })

    it("reads a branch's value and gathers the collect node of ITS item only", () => {
        expect(loopBranchOf({ loop: "each", index: 2, key: "o-3" })).toEqual({ loop: "each", index: 2, key: "o-3" })
        expect(loopBranchOf(null)).toBeNull()
        expect(itemBranchIdOf("each", "o-3")).toBe("each[o-3]")
        const branch = { loop: "each", index: 0, key: "o-1" }
        const steps = { "each[o-1].record": { output: { mine: true } }, "each[o-2].record": { output: { mine: false } } }
        expect(branchGatheredOf({ collect: "record" }, branch, steps, "each[o-1].send")).toEqual({ mine: true })
        expect(branchGatheredOf({ collect: "record" }, branch, {}, "each[o-1].send")).toBeNull()
        expect(branchGatheredOf({ collect: null }, branch, { "each[o-1].send": { output: 5 } }, "each[o-1].send")).toBe(5)
    })
})
