import { MemorySaver } from "@langchain/langgraph-checkpoint"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"
import { LanggraphClient } from "./langgraph.client"
import { GRAPH_CHECKPOINTS, LANGGRAPH_OPTIONS } from "./langgraph.decorators"
import { LanggraphLogEvent } from "./langgraph.log-events"
import type { LanggraphOptions } from "./langgraph.options"
import { THREAD_END } from "./langgraph.port"
import type { ThreadGraph, ThreadGraphNode, ThreadNodeRun, ThreadRef } from "./langgraph.port"

const OPTIONS: LanggraphOptions = { compiledMax: 2, stepLimit: 50 }
const THREAD: ThreadRef = { workspaceId: "ws-1", runId: "run-1" }
const GATE = "__freeze"
/** The failure a node throws in these specs: any `DomainError` of the capability stands in for "the node broke". */
const NODE_FAILURE = LanggraphErrorCode.ThreadUnreadable
const nodeFailure = (): LanggraphError => new LanggraphError({ code: NODE_FAILURE })

const build = async (saver: MemorySaver = new MemorySaver(), options: LanggraphOptions = OPTIONS) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LanggraphClient,
            { provide: GRAPH_CHECKPOINTS, useValue: saver },
            { provide: LANGGRAPH_OPTIONS, useValue: options },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { threads: moduleRef.get(LanggraphClient), saver, logger }
}

/** A gate as the engine draws it: it stops first, then goes where the decision says. */
const gate = (back: string): ThreadGraphNode => ({
    key: GATE,
    ends: [back],
    run: (state, scope) => {
        const decision = scope.stop<{ readonly kind: string; readonly text?: string }>({ about: state.trouble })
        if (decision.kind === "skip") return Promise.resolve({ update: { trouble: null }, goto: THREAD_END })
        return Promise.resolve({ update: { trouble: null, founderAnswers: [...state.founderAnswers, decision] }, goto: back })
    },
})

const graphOf = (version: string, nodes: ReadonlyArray<ThreadGraphNode>): ThreadGraph => ({
    version,
    entry: nodes[0]?.key ?? "",
    nodes,
})

/** A step that stops for the founder until an answer is in the state, then completes. */
const askingStep =
    (runs: Array<number>): ThreadNodeRun =>
    (state) => {
        runs.push(state.founderAnswers.length)
        return Promise.resolve(state.founderAnswers.length === 0
            ? { update: { trouble: { reason: "unclear" } }, goto: GATE }
            : { update: { steps: { consult: { answered: state.founderAnswers.length } } } })
    }

/** A pending promise and the function that settles it. */
interface Latch {
    readonly wait: Promise<void>
    readonly open: () => void
}

/** A promise and the function that settles it, to hold a node open. */
const latch = (): Latch => {
    const gate = { open: (): void => undefined }
    const wait = new Promise<void>((resolve) => {
        gate.open = resolve
    })
    return { wait, open: () => gate.open() }
}

describe("LanggraphClient", () => {
    describe("a thread from start to end", () => {
        it("runs the nodes in the order their answers name and merges step outputs by node key", async () => {
            const { threads } = await build()
            const graph = graphOf("v1", [
                { key: "greet", next: "branch", run: () => Promise.resolve({ update: { steps: { greet: { hello: true } } } }) },
                {
                    key: "branch",
                    ends: ["yes", "no"],
                    run: (state) => Promise.resolve({ update: { steps: { branch: "yes" } }, goto: "greet" in state.steps ? "yes" : "no" }),
                },
                { key: "yes", run: () => Promise.resolve({ update: { steps: { yes: 1 }, loop: { index: 0 } } }) },
                { key: "no", run: () => Promise.resolve({ update: { steps: { no: 1 } } }) },
            ])

            const outcome = await threads.start(THREAD, graph, { trigger: { tag: "t-1" } })

            expect(outcome).toEqual({
                status: "ended",
                state: {
                    trigger: { tag: "t-1" },
                    steps: { greet: { hello: true }, branch: "yes", yes: 1 },
                    trouble: null,
                    founderAnswers: [],
                    loop: { index: 0 },
                },
            })
            await expect(threads.stateOf(THREAD)).resolves.toMatchObject({ version: "v1", status: "ended", next: [], stop: null })
        })

        it("hands every node the thread, its key and the pinned version", async () => {
            const { threads } = await build()
            const seen: Array<unknown> = []
            const graph = graphOf("v7", [
                {
                    key: "only",
                    run: (_state, scope) => {
                        seen.push({ thread: scope.thread, node: scope.node, version: scope.version })
                        return Promise.resolve({})
                    },
                },
            ])

            await threads.start(THREAD, graph, { trigger: null })

            expect(seen).toEqual([{ thread: THREAD, node: "only", version: "v7" }])
        })

        it("hands the saver the workspace and the caller's fence on every write", async () => {
            const { threads, saver } = await build()
            const put = jest.spyOn(saver, "put")
            const graph = graphOf("v1", [{ key: "only", run: () => Promise.resolve({}) }])

            await threads.start(THREAD, graph, { trigger: null }, { fence: 7 })

            expect(put).toHaveBeenCalled()
            for (const [config] of put.mock.calls)
                expect(config.configurable).toMatchObject({ thread_id: "run-1", workspace_id: "ws-1", fence: 7 })
        })

        it("refuses a start on a thread that already has a checkpoint, so an input is never fed twice", async () => {
            const { threads } = await build()
            const runs: Array<number> = []
            const graph = graphOf("v1", [{ key: "only", run: () => Promise.resolve({ update: { steps: { only: runs.push(1) } } }) }])
            await threads.start(THREAD, graph, { trigger: "first" })

            await expect(threads.start(THREAD, graph, { trigger: "second" })).rejects.toMatchObject({
                code: LanggraphErrorCode.ThreadExists,
            })
            expect(runs).toHaveLength(1)
            await expect(threads.stateOf(THREAD)).resolves.toMatchObject({ state: { trigger: "first" } })
        })
    })

    describe("a stop and its decision", () => {
        it("stops at the gate with the question, and a decision runs the stopped step again with the founder's words", async () => {
            const { threads } = await build()
            const runs: Array<number> = []
            const graph = graphOf("v1", [{ key: "consult", ends: [GATE], run: askingStep(runs) }, gate("consult")])

            const stopped = await threads.start(THREAD, graph, { trigger: null })

            expect(stopped).toMatchObject({
                status: "stopped",
                stop: { node: GATE, question: { about: { reason: "unclear" } } },
                state: { trouble: { reason: "unclear" } },
            })
            await expect(threads.stateOf(THREAD)).resolves.toMatchObject({ status: "stopped", next: [GATE], stop: { node: GATE } })

            const ended = await threads.resume(THREAD, graph, { kind: "answer", text: "ship to Hue" })

            expect(ended).toMatchObject({
                status: "ended",
                state: {
                    steps: { consult: { answered: 1 } },
                    trouble: null,
                    founderAnswers: [{ kind: "answer", text: "ship to Hue" }],
                },
            })
            expect(runs).toEqual([0, 1])
        })

        it("runs nothing when a stopped thread is driven, however often: only a decision moves it", async () => {
            const { threads } = await build()
            const runs: Array<number> = []
            const gateRuns: Array<number> = []
            const counted = gate("consult")
            const graph = graphOf("v1", [
                { key: "consult", ends: [GATE], run: askingStep(runs) },
                { ...counted, run: (state, scope) => Promise.resolve((gateRuns.push(1), counted.run(state, scope))) },
            ])
            await threads.start(THREAD, graph, { trigger: null })

            const first = await threads.drive(THREAD, graph)
            const second = await threads.drive(THREAD, graph)
            const third = await threads.drive(THREAD, graph)

            expect([first.status, second.status, third.status]).toEqual(["stopped", "stopped", "stopped"])
            expect(runs).toEqual([0])
            expect(gateRuns).toHaveLength(1)
        })

        it("ends the thread on a decision the gate maps to the end, and answers an ended thread as ended", async () => {
            const { threads } = await build()
            const runs: Array<number> = []
            const graph = graphOf("v1", [{ key: "consult", ends: [GATE], run: askingStep(runs) }, gate("consult")])
            await threads.start(THREAD, graph, { trigger: null })

            const skipped = await threads.resume(THREAD, graph, { kind: "skip" })
            const driven = await threads.drive(THREAD, graph)

            expect(skipped.status).toBe("ended")
            expect(driven).toEqual(skipped)
            expect(runs).toEqual([0])
        })

        it("refuses a decision for a thread that does not wait for one", async () => {
            const { threads } = await build()
            const graph = graphOf("v1", [{ key: "only", run: () => Promise.resolve({}) }])
            await threads.start(THREAD, graph, { trigger: null })

            await expect(threads.resume(THREAD, graph, { kind: "retry" })).rejects.toMatchObject({
                code: LanggraphErrorCode.ThreadNotStopped,
            })
        })

        it("keeps a decision the library stored when the node it restarted threw: the next drive carries it on", async () => {
            const { threads } = await build()
            const decisions: Array<unknown> = []
            const fail = { once: true }
            const graph = graphOf("v1", [
                {
                    key: GATE,
                    run: (_state, scope) => {
                        const decision = scope.stop<object>({ ask: true })
                        decisions.push(decision)
                        if (fail.once) {
                            fail.once = false
                            return Promise.reject(nodeFailure())
                        }
                        return Promise.resolve({ update: { steps: { [GATE]: decision } } })
                    },
                },
            ])
            await threads.start(THREAD, graph, { trigger: null })

            await expect(threads.resume(THREAD, graph, { kind: "retry" })).rejects.toMatchObject({ code: NODE_FAILURE })
            await expect(threads.stateOf(THREAD)).resolves.toMatchObject({ status: "open", next: [GATE], stop: null })
            const driven = await threads.drive(THREAD, graph)

            expect(driven).toMatchObject({ status: "ended", state: { steps: { [GATE]: { kind: "retry" } } } })
            expect(decisions).toEqual([{ kind: "retry" }, { kind: "retry" }])
        })
    })

    describe("finding: the library does not lock a thread", () => {
        it("answers busy to a second call on a thread this process is driving, and the node runs once", async () => {
            const { threads, logger } = await build()
            const held = latch()
            const runs: Array<number> = []
            const graph = graphOf("v1", [
                {
                    key: "slow",
                    run: async () => {
                        runs.push(1)
                        await held.wait
                        return { update: { steps: { slow: true } } }
                    },
                },
            ])

            const first = threads.start(THREAD, graph, { trigger: null })
            const second = await threads.start(THREAD, graph, { trigger: null })
            const third = await threads.drive(THREAD, graph)
            const fourth = await threads.resume(THREAD, graph, { kind: "retry" })
            held.open()

            expect([second, third, fourth]).toEqual([{ status: "busy" }, { status: "busy" }, { status: "busy" }])
            await expect(first).resolves.toMatchObject({ status: "ended" })
            expect(runs).toHaveLength(1)
            expect(logger.warn).toHaveBeenCalledWith(LanggraphLogEvent.ThreadBusy, { thread: "run-1", call: "drive" })
        })

        it("lets the thread be driven again once the first call is over, also when it threw", async () => {
            const { threads } = await build()
            const fail = { once: true }
            const graph = graphOf("v1", [
                {
                    key: "flaky",
                    run: () => {
                        if (fail.once) {
                            fail.once = false
                            return Promise.reject(nodeFailure())
                        }
                        return Promise.resolve({ update: { steps: { flaky: "done" } } })
                    },
                },
            ])

            await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: NODE_FAILURE })
            await expect(threads.stateOf(THREAD)).resolves.toMatchObject({ status: "open", next: ["flaky"] })

            await expect(threads.drive(THREAD, graph)).resolves.toMatchObject({
                status: "ended",
                state: { steps: { flaky: "done" } },
            })
        })

        it("does not hold two threads against each other", async () => {
            const { threads } = await build()
            const held = latch()
            const graph = graphOf("v1", [{ key: "slow", run: async () => (await held.wait, {}) }])

            const one = threads.start(THREAD, graph, { trigger: null })
            const other = threads.start({ workspaceId: "ws-1", runId: "run-2" }, graph, { trigger: null })
            held.open()

            await expect(Promise.all([one, other])).resolves.toMatchObject([{ status: "ended" }, { status: "ended" }])
        })
    })

    describe("finding: a resume on a changed graph does nothing and says nothing", () => {
        const v5 = (runs: Array<number>): ThreadGraph =>
            graphOf("v5", [{ key: "consult", ends: [GATE], run: askingStep(runs) }, gate("consult")])
        const v6 = (runs: Array<number>): ThreadGraph =>
            graphOf("v6", [{ key: "advise", ends: [GATE], run: askingStep(runs) }, gate("advise")])

        it("refuses a decision given with another version than the thread started on, and leaves the thread stopped", async () => {
            const { threads } = await build()
            const runs: Array<number> = []
            await threads.start(THREAD, v5(runs), { trigger: null })

            await expect(threads.resume(THREAD, v6(runs), { kind: "answer", text: "go" })).rejects.toMatchObject({
                code: LanggraphErrorCode.VersionMismatch,
                params: { pinned: "v5", given: "v6" },
            })
            await expect(threads.drive(THREAD, v6(runs))).rejects.toMatchObject({ code: LanggraphErrorCode.VersionMismatch })
            await expect(threads.stateOf(THREAD)).resolves.toMatchObject({ version: "v5", status: "stopped" })
            expect(runs).toEqual([0])
        })

        it("runs the step of the pinned version when the decision comes with that version, after a newer one was used", async () => {
            const { threads } = await build()
            const old: Array<number> = []
            const fresh: Array<number> = []
            await threads.start(THREAD, v5(old), { trigger: null })
            await threads.start({ workspaceId: "ws-1", runId: "run-2" }, v6(fresh), { trigger: null })

            const ended = await threads.resume(THREAD, v5(old), { kind: "answer", text: "go" })

            expect(ended).toMatchObject({ status: "ended", state: { steps: { consult: { answered: 1 } } } })
            expect(old).toEqual([0, 1])
            expect(fresh).toEqual([0])
        })

        it("compiles a version once and keeps it, and lets the one used longest ago leave when the cache is full", async () => {
            const { threads, logger } = await build()
            const compiledOf = (): ReadonlyArray<unknown> =>
                logger.info.mock.calls.filter(([event]) => event === LanggraphLogEvent.GraphCompiled).map(([, fields]) => fields)
            const only = (version: string): ThreadGraph => graphOf(version, [{ key: "only", run: () => Promise.resolve({}) }])
            const thread = (runId: string): ThreadRef => ({ workspaceId: "ws-1", runId })

            await threads.start(thread("a"), only("v1"), { trigger: null })
            await threads.start(thread("b"), only("v1"), { trigger: null })
            await threads.start(thread("c"), only("v2"), { trigger: null })
            await threads.start(thread("d"), only("v3"), { trigger: null })
            await threads.start(thread("e"), only("v1"), { trigger: null })

            expect(compiledOf()).toEqual([
                { version: "v1", nodes: 1, kept: 1 },
                { version: "v2", nodes: 1, kept: 2 },
                { version: "v3", nodes: 1, kept: 2 },
                { version: "v1", nodes: 1, kept: 2 },
            ])
        })
    })

    describe("finding: a checkpoint is not there until it is stored", () => {
        it("answers absent for a thread with no checkpoint instead of the library's own error, and runs nothing", async () => {
            const { threads } = await build()
            const runs: Array<number> = []
            const graph = graphOf("v1", [{ key: "only", run: () => Promise.resolve((runs.push(1), {})) }])

            await expect(threads.drive(THREAD, graph)).resolves.toEqual({ status: "absent" })
            await expect(threads.resume(THREAD, graph, { kind: "retry" })).resolves.toEqual({ status: "absent" })
            await expect(threads.stateOf(THREAD)).resolves.toBeNull()
            expect(runs).toHaveLength(0)
        })

        it("leaves a thread whose very first write failed absent, so the caller's own record decides to start it again", async () => {
            const saver = new MemorySaver()
            const { threads } = await build(saver)
            const runs: Array<number> = []
            const graph = graphOf("v1", [{ key: "only", run: () => Promise.resolve((runs.push(1), { update: { steps: { only: 1 } } })) }])
            jest.spyOn(saver, "put").mockRejectedValueOnce(nodeFailure())

            await expect(threads.start(THREAD, graph, { trigger: "t" })).rejects.toMatchObject({ code: NODE_FAILURE })
            await expect(threads.stateOf(THREAD)).resolves.toBeNull()
            await expect(threads.drive(THREAD, graph)).resolves.toEqual({ status: "absent" })

            await expect(threads.start(THREAD, graph, { trigger: "t" })).resolves.toMatchObject({ status: "ended" })
        })

        it("runs the cut node again and none before it when a thread is driven after a throw", async () => {
            const { threads } = await build()
            const runs: Array<string> = []
            const fail = { once: true }
            const graph = graphOf("v1", [
                { key: "a", next: "b", run: () => Promise.resolve((runs.push("a"), { update: { steps: { a: 1 } } })) },
                {
                    key: "b",
                    run: () => {
                        runs.push("b")
                        if (fail.once) {
                            fail.once = false
                            return Promise.reject(nodeFailure())
                        }
                        return Promise.resolve({ update: { steps: { b: 2 } } })
                    },
                },
            ])

            await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: NODE_FAILURE })
            const driven = await threads.drive(THREAD, graph)

            expect(driven).toMatchObject({ status: "ended", state: { steps: { a: 1, b: 2 } } })
            expect(runs).toEqual(["a", "b", "b"])
        })
    })

    describe("what a thread may hold", () => {
        it.each([
            ["a trigger", { trigger: { at: new Date(0) } }, "start.trigger.at"],
            ["a trigger with a function", { trigger: { run: (): number => 1 } }, "start.trigger.run"],
        ])("refuses %s that is not plain JSON before anything is stored", async (_name, input, at) => {
            const { threads } = await build()
            const graph = graphOf("v1", [{ key: "only", run: () => Promise.resolve({}) }])

            await expect(threads.start(THREAD, graph, input)).rejects.toMatchObject({
                code: LanggraphErrorCode.NotPlain,
                params: { at },
            })
            await expect(threads.stateOf(THREAD)).resolves.toBeNull()
        })

        it("refuses a decision that is not plain JSON and leaves the thread stopped", async () => {
            const { threads } = await build()
            const graph = graphOf("v1", [{ key: "consult", ends: [GATE], run: askingStep([]) }, gate("consult")])
            await threads.start(THREAD, graph, { trigger: null })

            await expect(threads.resume(THREAD, graph, { kind: "answer", at: new Date(0) })).rejects.toMatchObject({
                code: LanggraphErrorCode.NotPlain,
                params: { at: "resume.decision.at" },
            })
            await expect(threads.stateOf(THREAD)).resolves.toMatchObject({ status: "stopped" })
        })
    })
})
