import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { CHECKPOINT_STORE, GRAPH_THREADS, LanggraphModule, THREAD_END } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadGraph, ThreadGraphNode, ThreadNodeAnswer, ThreadState } from "@modules/integrations/langgraph"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { memoryCheckpointStore } from "@tests/fixtures/builders/checkpoint-store.builder"
import {
    iterationEnded,
    iterationInputOf,
    loopFrameOf,
    loopStarted,
    loopStepKeyOf,
    loopSummaryOf,
    loopVisitOf,
} from "./compiler-loop.policy"
import type { ThreadLoopFrame } from "./compiler-loop.policy"
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
    grant: { rights: [], tools: [], effects: [] },
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
    joins: [],
    ended: null,
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
        expect(loopStarted("each", null, [1, 2])).toEqual({
            kind: "summed",
            output: { results: [{ index: 0, item: 1, output: null }, { index: 1, item: 2, output: null }], okCount: 2, failed: [] },
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

describe("the moves of a loop's frame", () => {
    it("starts the first iteration at the body with a fresh frame, and sums at once an empty list", () => {
        expect(loopStarted("each", "price", ["a", "b"])).toEqual({ kind: "iterate", frame: frameOf(0, ["a", "b"]), goto: "price" })
        expect(loopStarted("each", "price", [])).toEqual({ kind: "summed", output: { results: [], okCount: 0, failed: [] } })
    })

    it("starts on a visit with no ended iteration of its own, and joins one that ended", () => {
        expect(loopVisitOf("each", "price", null)).toEqual({ kind: "start" })
        expect(loopVisitOf("each", "price", frameOf(0, ["a"]))).toEqual({ kind: "start" })
        expect(loopVisitOf("each", "price", { ...frameOf(0, ["a"]), nodeKey: "other" })).toEqual({ kind: "start" })

        const ended = iterationEnded(frameOf(0, ["a", "b"]), { output: { price: 1 } })
        expect(loopVisitOf("each", "price", ended)).toEqual({
            kind: "join",
            move: {
                kind: "iterate",
                frame: frameOf(1, ["a", "b"], { joins: [{ index: 0, output: { price: 1 }, error: null }] }),
                goto: "price",
            },
        })
    })

    it("sums after the last iteration, each element in order and the failed ones apart, in the old engine's shape", () => {
        const last = iterationEnded(
            frameOf(1, ["a", "b"], { joins: [{ index: 0, output: { price: 1 }, error: null }] }),
            { error: { code: "out_of_stock", message: "Out of stock" } },
        )

        expect(loopVisitOf("each", "price", last)).toEqual({
            kind: "join",
            move: {
                kind: "summed",
                output: {
                    results: [{ index: 0, item: "a", output: { price: 1 } }],
                    okCount: 1,
                    failed: [{ index: 1, item: "b", error: { code: "out_of_stock", message: "Out of stock" } }],
                },
            },
        })
    })

    it("joins an iteration once, even when its end is seen twice", () => {
        const twice = iterationEnded(frameOf(0, ["a"], { joins: [{ index: 0, output: 1, error: null }] }), { output: 2 })

        expect(loopVisitOf("each", "price", twice)).toEqual({
            kind: "join",
            move: { kind: "summed", output: loopSummaryOf(["a"], [{ index: 0, output: 2, error: null }]) },
        })
    })

    it("reads back a frame stored as JSON, and nothing that is no frame", () => {
        const frame = iterationEnded(frameOf(1, [{ id: 1 }, null], { joins: [{ index: 0, output: null, error: null }] }), {
            output: "x",
        })

        expect(loopFrameOf(structuredClone(frame))).toEqual(frame)
        expect(loopFrameOf(null)).toBeNull()
        expect(loopFrameOf({ index: 0 })).toBeNull()
        expect(loopFrameOf([])).toBeNull()
    })

    it("runs a body node under the key of its iteration, and every other node under its own key", () => {
        expect(loopStepKeyOf("price", "each", frameOf(2, ["a", "b", "c"]))).toBe("price[2]")
        expect(loopStepKeyOf("price", "each", null)).toBe("price")
        expect(loopStepKeyOf("after", undefined, frameOf(2, ["a", "b", "c"]))).toBe("after")
        expect(iterationInputOf(frameOf(1, ["a", "b"]))).toEqual({
            item: { value: "b", index: 1 },
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
                const move = visit.kind === "join" ? visit.move : loopStarted(step.key, step.loop.body, items)
                if (move.kind === "iterate") return { update: { loop: move.frame }, goto: move.goto }
                return { update: { steps: { [step.key]: move.output }, loop: null }, goto: stepExitOf(step, move.output) }
            }
            const item = frame === null ? null : iterationInputOf(frame).item?.value
            const output =
                step.key === "list" ? { items: ["rose", "lily", "tulip"] } : step.key === "price" ? { priced: item } : { noted: item }
            const goto = stepExitOf(step, output)
            const ended = step.inLoop !== undefined && goto === step.inLoop && frame !== null
            return {
                update: { steps: { [step.key]: output }, ...(ended ? { loop: iterationEnded(frame, { output }) } : {}) },
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
        results: [
            { index: 0, item: "rose", output: { noted: "rose" } },
            { index: 1, item: "lily", output: { noted: "lily" } },
            { index: 2, item: "tulip", output: { noted: "tulip" } },
        ],
        okCount: 3,
        failed: [],
    }

    it("runs the body once per element, one iteration after the other, then the loop's output and the step after it", async () => {
        const threads = await threadsOf()
        const driven: Driven = { ran: [], crashAt: null }

        const outcome = await threads.start(REF, threadGraphOf(graphOf(LOOP_SPEC), driven), { trigger: {} })

        expect(driven.ran).toEqual([
            "list",
            "each",
            "price[0]",
            "note[0]",
            "each",
            "price[1]",
            "note[1]",
            "each",
            "price[2]",
            "note[2]",
            "each",
            "after",
        ])
        expect(outcome.status).toBe("ended")
        expect(outcome.status === "ended" ? outcome.state.steps.each : null).toEqual(SUMMARY)
        expect(outcome.status === "ended" ? outcome.state.loop : "open").toBeNull()
    })

    it("goes on in the iteration it was in after a crash: a joined iteration never runs again", async () => {
        const threads = await threadsOf()
        const driven: Driven = { ran: [], crashAt: "note[1]" }
        const graph = threadGraphOf(graphOf(LOOP_SPEC), driven)

        await expect(threads.start(REF, graph, { trigger: {} })).rejects.toThrow("crash at note[1]")
        const outcome = await threads.drive(REF, graph)

        expect(driven.ran).toEqual([
            "list",
            "each",
            "price[0]",
            "note[0]",
            "each",
            "price[1]",
            "note[1]",
            "note[1]",
            "each",
            "price[2]",
            "note[2]",
            "each",
            "after",
        ])
        expect(outcome.status === "ended" ? outcome.state.steps.each : null).toEqual(SUMMARY)
    })
})
