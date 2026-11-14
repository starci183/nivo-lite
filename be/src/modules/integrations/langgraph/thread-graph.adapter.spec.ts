import { Command, isInterrupted } from "@langchain/langgraph"
import { MemorySaver } from "@langchain/langgraph-checkpoint"
import { Test } from "@nestjs/testing"
import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"
import { THREAD_END } from "./langgraph.port"
import type { ThreadGraph, ThreadGraphNode } from "./langgraph.port"
import { compiledOf } from "./thread-graph.adapter"
import { openingOf } from "./thread-state.policy"

/** The members of the subject under test. */
interface Subject {
    readonly compiledOf: typeof compiledOf
}

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("thread-graph.adapter")

/** The adapter, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { compiledOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const done: ThreadGraphNode["run"] = () => Promise.resolve({})
const graphOf = (nodes: ReadonlyArray<ThreadGraphNode>, entry = nodes[0]?.key ?? ""): ThreadGraph => ({
    version: "v1",
    entry,
    nodes,
})
const configOf = (runId: string) => ({ configurable: { thread_id: runId, workspace_id: "ws-1" } })
const opening = (version: string, entry: string) => openingOf({ trigger: null }, { pin: version, cursor: entry })

describe("thread-graph.adapter", () => {
    describe("what the library does on its own (why the client guards it)", () => {
        it("runs two calls on one thread at the same moment: it has no lock", async () => {
            const subject = await build()
            const gate = { open: (): void => undefined }
            const promise = new Promise<void>((settle) => {
                gate.open = settle
            })
            const flight = { now: 0, most: 0 }
            const compiled = subject.compiledOf(
                graphOf([
                    {
                        key: "slow",
                        run: async () => {
                            flight.now += 1
                            flight.most = Math.max(flight.most, flight.now)
                            await promise
                            flight.now -= 1
                            return {}
                        },
                    },
                ]),
                new MemorySaver(),
            )

            const both = [compiled.invoke(opening("v1", "slow"), configOf("t")), compiled.invoke(opening("v1", "slow"), configOf("t"))]
            await new Promise((settle) => setImmediate(settle))
            const most = flight.most
            gate.open()
            await Promise.all(both)

            expect(most).toBe(2)
        })

        it("does nothing and throws nothing when a thread stopped at a node is resumed on a graph without that node", async () => {
            const subject = await build()
            const saver = new MemorySaver()
            const runs = { old: 0, renamed: 0 }
            const stopper =
                (count: () => void): ThreadGraphNode["run"] =>
                (_state, scope) => {
                    count()
                    scope.stop({ ask: true })
                    return Promise.resolve({})
                }
            const old = subject.compiledOf(graphOf([{ key: "consult", run: stopper(() => (runs.old += 1)) }]), saver)
            const renamed = subject.compiledOf(graphOf([{ key: "advise", run: stopper(() => (runs.renamed += 1)) }]), saver)
            await old.invoke(opening("v1", "consult"), configOf("t"))

            const result: unknown = await renamed.invoke(new Command({ resume: { kind: "retry" } }), configOf("t"))

            expect(runs).toEqual({ old: 1, renamed: 0 })
            expect(isInterrupted(result)).toBe(false)
            expect(result).toMatchObject({ cursor: "consult" })
        })

        it("raises its own error when a thread with no checkpoint is continued", async () => {
            const subject = await build()
            const compiled = subject.compiledOf(graphOf([{ key: "only", run: done }]), new MemorySaver())

            await expect(compiled.invoke(null, configOf("t"))).rejects.toMatchObject({ name: "EmptyInputError" })
        })
    })

    describe("a graph that cannot be compiled", () => {
        it.each([
            ["no node at all", graphOf([]), ""],
            ["an entry it does not have", graphOf([{ key: "a", run: done }], "b"), "b"],
            ["a key used twice", graphOf([{ key: "a", run: done }, { key: "a", run: done }]), "a"],
            ["the end key as a node", graphOf([{ key: THREAD_END, run: done }]), THREAD_END],
            ["the library's start key as a node", graphOf([{ key: "__start__", run: done }]), "__start__"],
            ["an empty key", graphOf([{ key: "", run: done }]), ""],
            ["a next it does not have", graphOf([{ key: "a", next: "gone", run: done }]), "a"],
            ["a branch it does not have", graphOf([{ key: "a", ends: ["gone"], run: done }]), "a"],
            ["a node no route leads to", graphOf([{ key: "a", run: done }, { key: "island", run: done }]), "island"],
        ])("refuses a graph with %s, naming the node", async (_name, graph, node) => {
            const subject = await build()

            expect(thrownBy(() => subject.compiledOf(graph, new MemorySaver()))).toEqual(objectLike({ code: LanggraphErrorCode.GraphUnsound, params: { node } }))
        })
    })

    describe("what a node may answer", () => {
        it("refuses a route the node did not declare and leaves the thread at the node", async () => {
            const subject = await build()
            const saver = new MemorySaver()
            const compiled = subject.compiledOf(
                graphOf([
                    { key: "a", next: "b", run: () => Promise.resolve({ goto: "c" }) },
                    { key: "b", next: "c", run: done },
                    { key: "c", run: done },
                ]),
                saver,
            )

            await expect(compiled.invoke(opening("v1", "a"), configOf("t"))).rejects.toMatchObject({
                code: LanggraphErrorCode.RouteUndeclared,
                params: { node: "a", goto: "c" },
            })
            const tuple = await saver.getTuple(configOf("t"))
            expect(tuple?.checkpoint.channel_values).toMatchObject({ cursor: "a" })
        })

        it("takes the end as a route of every node", async () => {
            const subject = await build()
            const compiled = subject.compiledOf(
                graphOf([
                    { key: "a", next: "b", run: () => Promise.resolve({ goto: THREAD_END }) },
                    { key: "b", run: () => Promise.resolve({ update: { steps: { b: 1 } } }) },
                ]),
                new MemorySaver(),
            )

            await expect(compiled.invoke(opening("v1", "a"), configOf("t"))).resolves.toMatchObject({
                steps: {},
                cursor: THREAD_END,
            })
        })

        it.each([
            ["an update", () => Promise.resolve({ update: { steps: { a: new Map() } } }), "update.steps.a"],
            ["a trouble", () => Promise.resolve({ update: { trouble: { cause: new Error("x") } } }), "update.trouble.cause"],
        ] satisfies ReadonlyArray<[string, ThreadGraphNode["run"], string]>)(
            "refuses %s that is not plain JSON",
            async (_name, run, at) => {
                const subject = await build()
                const compiled = subject.compiledOf(graphOf([{ key: "a", run }]), new MemorySaver())

                await expect(compiled.invoke(opening("v1", "a"), configOf("t"))).rejects.toMatchObject({
                    code: LanggraphErrorCode.NotPlain,
                    params: { at },
                })
            },
        )

        it("refuses a stop whose question is not plain JSON", async () => {
            const subject = await build()
            const compiled = subject.compiledOf(
                graphOf([{ key: "a", run: (_state, scope) => Promise.resolve(scope.stop({ when: new Date(0) })) }]),
                new MemorySaver(),
            )

            await expect(compiled.invoke(opening("v1", "a"), configOf("t"))).rejects.toMatchObject({
                code: LanggraphErrorCode.NotPlain,
                params: { at: "stop.question.when" },
            })
        })

        it("tries a node once: a throw is not retried by the library", async () => {
            const subject = await build()
            const runs = { count: 0 }
            const compiled = subject.compiledOf(
                graphOf([
                    {
                        key: "a",
                        run: () => {
                            runs.count += 1
                            return Promise.reject(new LanggraphError({ code: LanggraphErrorCode.GraphUnsound }))
                        },
                    },
                ]),
                new MemorySaver(),
            )

            await expect(compiled.invoke(opening("v1", "a"), configOf("t"))).rejects.toMatchObject({ code: LanggraphErrorCode.GraphUnsound })
            expect(runs.count).toBe(1)
        })
    })
})
