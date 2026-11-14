import { MemorySaver } from "@langchain/langgraph-checkpoint"
import { Test } from "@nestjs/testing"
import { defineEffect, defineTool } from "@nivo-lite/agent-sdk/node"
import type { EffectCall, NodeHostPorts, NodeModelRequest, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { mock } from "@starci/jest-preset"
import { z } from "zod"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LanggraphError, LanggraphErrorCode } from "./errors/langgraph.error"
import { LanggraphClient } from "./langgraph.client"
import { GRAPH_CHECKPOINTS, LANGGRAPH_OPTIONS } from "./langgraph.decorators"
import { LanggraphLogEvent } from "./langgraph.log-events"
import type { ThreadGraph, ThreadNodeRun, ThreadRef } from "./langgraph.port"
import { replayPortsOf, replayRunOf, turnRecordOf } from "./replay-ports.adapter"

const THREAD: ThreadRef = { workspaceId: "ws-1", runId: "run-1" }
const STEP_KEY = "run-1:consult"

const ORDER_CREATE = defineEffect({
    id: "sales.order.create",
    title: { key: "orderCreate" },
    payload: z.object({ qty: z.number() }).strict(),
})
const MESSAGE_SEND = defineEffect({
    id: "nivo.tool.customer.message.send",
    title: { key: "messageSend" },
    payload: z.object({ text: z.string().max(500) }).strict(),
})
const ORDER_READ = defineTool({
    id: "sales.order.read",
    title: { key: "orderRead" },
    args: z.object({ orderId: z.string().max(500) }).strict(),
    result: z.object({ total: z.number() }).strict(),
    mutates: false,
})
const TURN = z.object({ say: z.string().max(500) }).strict()

/** A refusal as a door throws it: a class of its own, which the node tells apart by class. */
class ApprovalRequired extends LanggraphError {}

/** The code the refusals and cuts of these specs carry: any code of the capability stands in for "the call failed". */
const FAILURE = LanggraphErrorCode.ThreadNotStopped
const failureOf = (): LanggraphError => new LanggraphError({ code: FAILURE })

/** Settles a call into its result or its cause, so a failure is carried on and never swallowed. */
const attemptOf = <Value>(call: Promise<Value>): Promise<{ readonly done: Value } | { readonly cause: unknown }> =>
    call.then(
        (done) => ({ done }),
        (cause: unknown) => ({ cause }),
    )

/** A saver that loses every recorded call, as a crash between an effect and its record does: the checkpoint is there, the record is not. */
class ForgetfulSaver extends MemorySaver {
    override async putWrites(...args: Parameters<MemorySaver["putWrites"]>): Promise<void> {
        const [config, writes, taskId] = args
        await super.putWrites(
            config,
            writes.filter(([channel]) => channel !== "__return__"),
            taskId,
        )
    }
}

/** What a host's ports were called with, in order. */
interface HostSeen {
    readonly execute: Array<string>
    readonly tool: Array<string>
    readonly model: Array<string>
    read: number
    now: number
}

/** Counts every call a host's ports receive, and answers from a script. */
const hostOf = () => {
    const seen: HostSeen = { execute: [], tool: [], model: [], read: 0, now: 0 }
    const refuse = { tool: 0 }
    const ports: NodeHostPorts = {
        read: () => {
            seen.read += 1
            return Promise.resolve([])
        },
        write: (kind) => Promise.resolve({ kind, id: "w-1" }),
        now: () => {
            seen.now += 1
            return new Date(0)
        },
        execute: (effect, _payload, call): Promise<SubjectRef> => {
            seen.execute.push(`${effect.id}:${call.key}`)
            return Promise.resolve({ kind: "sales.order", id: `subject-${seen.execute.length}` })
        },
        callTool: (tool, _args, key) => {
            seen.tool.push(`${tool.id}:${key}`)
            if (refuse.tool > 0) {
                refuse.tool -= 1
                return Promise.reject(new ApprovalRequired({ code: FAILURE }))
            }
            return Promise.resolve({ total: 1000 * seen.tool.length })
        },
        model: {
            text: (request) => {
                seen.model.push(`text:${request.purpose}`)
                return Promise.resolve(`text-${seen.model.length}`)
            },
            json: (schema, request) => {
                seen.model.push(`json:${request.purpose}`)
                return Promise.resolve(schema.parse({ say: `turn-${seen.model.length}` }))
            },
        },
    }
    return { ports, seen, refuse }
}

/** How many model turns a host's loop has asked for. */
interface AskCount {
    count: number
}

const ask = (purpose: string): NodeModelRequest => ({ purpose, instructions: "stable", input: {} })
const callOf = (digest: string): EffectCall => ({ key: `${STEP_KEY}:${digest}`, dedupeKey: null })

const build = async (saver: MemorySaver = new MemorySaver()) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LanggraphClient,
            { provide: GRAPH_CHECKPOINTS, useValue: saver },
            { provide: LANGGRAPH_OPTIONS, useValue: { compiledMax: 5, stepLimit: 20 } },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { threads: moduleRef.get(LanggraphClient), logger }
}

const graphOf = (run: ThreadNodeRun): ThreadGraph => ({ version: "v1", entry: "consult", nodes: [{ key: "consult", run }] })

/** Throws on the first pass only: the cut between what a node did and its checkpoint. */
const cutOnce = (): (() => void) => {
    const left = { cuts: 1 }
    return () => {
        if (left.cuts > 0) {
            left.cuts -= 1
            throw failureOf()
        }
    }
}

describe("replayPortsOf", () => {
    it("returns the ports themselves outside the run of a node", () => {
        const { ports } = hostOf()

        expect(replayPortsOf(ports)).toBe(ports)
    })

    it("does not make a finished model call, effect or tool call again when the node restarts after a throw", async () => {
        const { threads, logger } = await build()
        const host = hostOf()
        const cut = cutOnce()
        const outputs: Array<unknown> = []
        const graph = graphOf(async () => {
            const ports = threads.replayPortsOf(host.ports)
            const turn = await ports.model.json(TURN, ask("consult:agent"))
            const order = await ports.execute(ORDER_CREATE, { qty: 1 }, callOf("aaaa"))
            const read = await ports.callTool(ORDER_READ, { orderId: order.id }, `${STEP_KEY}:bbbb`)
            const words = await ports.model.text(ask("consult:words"))
            outputs.push({ turn, order, read, words })
            cut()
            return { update: { steps: { consult: { order: order.id } } } }
        })

        await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: FAILURE })
        const driven = await threads.drive(THREAD, graph)

        expect(driven).toMatchObject({ status: "ended", state: { steps: { consult: { order: "subject-1" } } } })
        expect(host.seen.model).toEqual(["json:consult:agent", "text:consult:words"])
        expect(host.seen.execute).toEqual([`sales.order.create:${STEP_KEY}:aaaa`])
        expect(host.seen.tool).toEqual([`sales.order.read:${STEP_KEY}:bbbb`])
        expect(outputs[1]).toEqual(outputs[0])
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("does not repeat what a node did before it stopped for a person when the decision restarts it", async () => {
        const { threads } = await build()
        const host = hostOf()
        const graph = graphOf(async (_state, scope) => {
            const ports = threads.replayPortsOf(host.ports)
            const order = await ports.execute(ORDER_CREATE, { qty: 1 }, callOf("aaaa"))
            const verdict = scope.stop<{ readonly approved: boolean }>({ approve: order.id })
            const sent = await ports.execute(MESSAGE_SEND, { text: "done" }, callOf("cccc"))
            return { update: { steps: { consult: { order: order.id, sent: sent.id, approved: verdict.approved } } } }
        })

        await threads.start(THREAD, graph, { trigger: null })
        const ended = await threads.resume(THREAD, graph, { approved: true })

        expect(ended).toMatchObject({
            status: "ended",
            state: { steps: { consult: { order: "subject-1", sent: "subject-2", approved: true } } },
        })
        expect(host.seen.execute).toEqual([`sales.order.create:${STEP_KEY}:aaaa`, `nivo.tool.customer.message.send:${STEP_KEY}:cccc`])
    })

    it("passes read, write and now through unrecorded: a restart reads the world again", async () => {
        const { threads } = await build()
        const host = hostOf()
        const cut = cutOnce()
        const graph = graphOf(async () => {
            const ports = threads.replayPortsOf(host.ports)
            await ports.read("sales.order", { fields: ["id"] }, "turn")
            ports.now()
            cut()
            return {}
        })

        await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: FAILURE })
        await threads.drive(THREAD, graph)

        expect(host.seen).toMatchObject({ read: 2, now: 2 })
    })

    it("hands a port's own error to the node as it was thrown, and the drive goes on when the node handles it", async () => {
        const { threads } = await build()
        const host = hostOf()
        host.refuse.tool = 1
        const caught: Array<unknown> = []
        const graph = graphOf(async () => {
            const ports = threads.replayPortsOf(host.ports)
            const attempt = await attemptOf(ports.callTool(ORDER_READ, { orderId: "o-1" }, `${STEP_KEY}:bbbb`))
            if ("cause" in attempt) caught.push(attempt.cause)
            const read = "done" in attempt ? attempt.done : null
            const words = await ports.model.text(ask("consult:words"))
            return { update: { steps: { consult: { read, words } } } }
        })

        const ended = await threads.start(THREAD, graph, { trigger: null })

        expect(ended).toMatchObject({ status: "ended", state: { steps: { consult: { read: null, words: "text-1" } } } })
        expect(caught).toHaveLength(1)
        expect(caught[0]).toBeInstanceOf(ApprovalRequired)
        expect(caught[0]).toMatchObject({ code: FAILURE })
    })

    it("tries a call that failed again on a restart and makes everything after it live, never replaying a failure", async () => {
        const { threads, logger } = await build()
        const host = hostOf()
        host.refuse.tool = 1
        const graph = graphOf(async (_state, scope) => {
            const ports = threads.replayPortsOf(host.ports)
            const turn = await ports.model.json(TURN, ask("consult:agent"))
            const attempt = await attemptOf(ports.callTool(ORDER_READ, { orderId: "o-1" }, `${STEP_KEY}:bbbb`))
            const read = "done" in attempt ? attempt.done : null
            if (read === null) scope.stop({ approve: "sales.order.read" })
            const words = await ports.model.text(ask("consult:words"))
            return { update: { steps: { consult: { turn, read, words } } } }
        })

        const stopped = await threads.start(THREAD, graph, { trigger: null })
        const ended = await threads.resume(THREAD, graph, { approved: true })

        expect(stopped.status).toBe("stopped")
        expect(ended).toMatchObject({
            status: "ended",
            state: { steps: { consult: { turn: { say: "turn-1" }, read: { total: 2000 }, words: "text-2" } } },
        })
        expect(host.seen.model).toEqual(["json:consult:agent", "text:consult:words"])
        expect(host.seen.tool).toHaveLength(2)
        expect(logger.warn).toHaveBeenCalledWith(LanggraphLogEvent.ReplayLeft, {
            thread: "run-1",
            position: 1,
            why: "failed-before",
        })
    })

    it("never hands a restarted node the answer of another call: from the first call that differs the run is live", async () => {
        const { threads, logger } = await build()
        const host = hostOf()
        const cut = cutOnce()
        const pass = { count: 0 }
        const graph = graphOf(async () => {
            pass.count += 1
            const ports = threads.replayPortsOf(host.ports)
            const turn = await ports.model.json(TURN, ask("consult:agent"))
            // The second pass takes another course, as a node whose own code branches on a fresh read would.
            const digest = pass.count === 1 ? "aaaa" : "zzzz"
            const order = await ports.execute(ORDER_CREATE, { qty: pass.count }, callOf(digest))
            const sent = await ports.execute(MESSAGE_SEND, { text: "hi" }, callOf("cccc"))
            cut()
            return { update: { steps: { consult: { turn, order: order.id, sent: sent.id } } } }
        })

        await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: FAILURE })
        const driven = await threads.drive(THREAD, graph)

        expect(driven).toMatchObject({
            status: "ended",
            state: { steps: { consult: { turn: { say: "turn-1" }, order: "subject-3", sent: "subject-4" } } },
        })
        expect(host.seen.model).toEqual(["json:consult:agent"])
        expect(host.seen.execute).toEqual([
            `sales.order.create:${STEP_KEY}:aaaa`,
            `nivo.tool.customer.message.send:${STEP_KEY}:cccc`,
            `sales.order.create:${STEP_KEY}:zzzz`,
            `nivo.tool.customer.message.send:${STEP_KEY}:cccc`,
        ])
        expect(logger.warn).toHaveBeenCalledWith(LanggraphLogEvent.ReplayLeft, {
            thread: "run-1",
            position: 1,
            why: "asks-another",
        })
    })

    it("is no proof on its own: when the record of a call is lost the port is called again, and only a ledger under it holds the effect at one", async () => {
        const { threads } = await build(new ForgetfulSaver())
        const host = hostOf()
        const cut = cutOnce()
        const ledger = new Map<string, Promise<SubjectRef>>()
        const acts: Array<string> = []
        // The effect ledger of the host, in small: one act per call key, a repeat answers the first subject.
        const guarded: NodeHostPorts = {
            ...host.ports,
            execute: (effect, payload, call) => {
                const kept = ledger.get(call.key)
                if (kept !== undefined) return kept
                acts.push(call.key)
                const made = host.ports.execute(effect, payload, call)
                ledger.set(call.key, made)
                return made
            },
        }
        const graph = graphOf(async () => {
            const ports = threads.replayPortsOf(guarded)
            const sent = await ports.execute(MESSAGE_SEND, { text: "hi" }, callOf("cccc"))
            const words = await ports.model.text(ask("consult:words"))
            cut()
            return { update: { steps: { consult: { sent: sent.id, words } } } }
        })

        await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: FAILURE })
        const driven = await threads.drive(THREAD, graph)

        expect(driven).toMatchObject({ status: "ended", state: { steps: { consult: { sent: "subject-1" } } } })
        expect(host.seen.model).toEqual(["text:consult:words", "text:consult:words"])
        expect(acts).toEqual([`${STEP_KEY}:cccc`])
        expect(host.seen.execute).toHaveLength(1)
    })

    describe("a model call is the same call only with the same content", () => {
        const GATE = "__freeze"
        const DECIDE = z.object({ confused: z.boolean() }).strict()

        /** The host's ports with the effect ledger in small above `execute`, and a model that answers from a script and keeps what it was asked. */
        const worldOf = (script: ReadonlyArray<boolean>) => {
            const host = hostOf()
            const ledger = new Map<string, Promise<SubjectRef>>()
            const acts: Array<string> = []
            const asked: Array<NodeModelRequest> = []
            const ports: NodeHostPorts = {
                ...host.ports,
                execute: (effect, payload, call) => {
                    const kept = ledger.get(call.key)
                    if (kept !== undefined) return kept
                    acts.push(call.key)
                    const made = host.ports.execute(effect, payload, call)
                    ledger.set(call.key, made)
                    return made
                },
                model: {
                    text: host.ports.model.text,
                    json: (schema, request) => {
                        asked.push(request)
                        return Promise.resolve(schema.parse({ confused: script[asked.length - 1] ?? false }))
                    },
                },
            }
            return { ports, acts, asked }
        }

        /** The engine's shape: a step that tells the customer one line, asks the model, and goes to the gate when the model is unsure. */
        const stopGraph = (threads: LanggraphClient, ports: NodeHostPorts): ThreadGraph => ({
            version: "v1",
            entry: "match",
            nodes: [
                {
                    key: "match",
                    ends: [GATE],
                    run: async (state) => {
                        const replayed = threads.replayPortsOf(ports)
                        const line = await replayed.execute(MESSAGE_SEND, { text: "received, checking" }, callOf("cccc"))
                        const turn = await replayed.model.json(DECIDE, {
                            purpose: "match:agent",
                            instructions: "stable",
                            input: { founderAnswers: state.founderAnswers },
                        })
                        if (turn.confused) return { update: { trouble: { question: "which order?" } }, goto: GATE }
                        return { update: { steps: { match: { settled: true, line: line.id } } } }
                    },
                },
                {
                    key: GATE,
                    ends: ["match"],
                    run: (state, scope) => {
                        const decision = scope.stop<{ readonly kind: string; readonly text?: string }>({ ask: state.trouble })
                        const words = decision.kind === "answer" ? [{ text: decision.text ?? "" }] : []
                        return Promise.resolve({
                            update: { trouble: null, founderAnswers: [...state.founderAnswers, ...words] },
                            goto: "match",
                        })
                    },
                },
            ],
        })

        it("asks the model again with the founder's answer after a stop, and the line already sent is not sent again", async () => {
            const { threads } = await build()
            const world = worldOf([true, false])
            const graph = stopGraph(threads, world.ports)

            const stopped = await threads.start(THREAD, graph, { trigger: null })
            const ended = await threads.resume(THREAD, graph, { kind: "answer", text: "it is order 0004" })

            expect(stopped).toMatchObject({ status: "stopped", stop: { node: GATE, question: { ask: { question: "which order?" } } } })
            expect(ended).toMatchObject({ status: "ended", state: { steps: { match: { settled: true, line: "subject-1" } } } })
            expect(world.asked.map((request) => request.input)).toEqual([
                { founderAnswers: [] },
                { founderAnswers: [{ text: "it is order 0004" }] },
            ])
            expect(world.acts).toEqual([`${STEP_KEY}:cccc`])
        })

        it("asks the model again after a retry with no words, although the request is the same: a record never outlives its visit", async () => {
            const { threads, logger } = await build()
            const world = worldOf([true, false])
            const graph = stopGraph(threads, world.ports)

            await threads.start(THREAD, graph, { trigger: null })
            const ended = await threads.resume(THREAD, graph, { kind: "retry" })

            expect(ended).toMatchObject({ status: "ended", state: { steps: { match: { settled: true } }, founderAnswers: [] } })
            expect(world.asked).toHaveLength(2)
            expect(world.asked[1]).toEqual(world.asked[0])
            expect(world.acts).toEqual([`${STEP_KEY}:cccc`])
            expect(logger.warn).not.toHaveBeenCalled()
        })

        it("stops again, once, when the model is still unsure after a retry: each visit asks it exactly once", async () => {
            const { threads } = await build()
            const world = worldOf([true, true, false])
            const graph = stopGraph(threads, world.ports)

            await threads.start(THREAD, graph, { trigger: null })
            const again = await threads.resume(THREAD, graph, { kind: "retry" })
            const ended = await threads.resume(THREAD, graph, { kind: "answer", text: "order 0004" })

            expect(again.status).toBe("stopped")
            expect(ended.status).toBe("ended")
            expect(world.asked).toHaveLength(3)
            expect(world.acts).toHaveLength(1)
        })

        it("asks the model again when a cut node restarts with other content (a new customer line), and replays it when the content is the same", async () => {
            const { threads, logger } = await build()
            const world = worldOf([false, false, false])
            const lines = ["hello"]
            const cuts = { left: 2 }
            const graph = graphOf(async () => {
                const replayed = threads.replayPortsOf(world.ports)
                const line = await replayed.execute(MESSAGE_SEND, { text: "received, checking" }, callOf("cccc"))
                await replayed.model.json(DECIDE, { purpose: "consult:agent", instructions: "stable", input: { lines: [...lines] } })
                if (cuts.left > 0) {
                    cuts.left -= 1
                    throw failureOf()
                }
                return { update: { steps: { consult: { line: line.id } } } }
            })

            await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: FAILURE })
            await expect(threads.drive(THREAD, graph)).rejects.toMatchObject({ code: FAILURE })
            const same = world.asked.length
            lines.push("I paid already")
            const driven = await threads.drive(THREAD, graph)

            expect(same).toBe(1)
            expect(driven).toMatchObject({ status: "ended", state: { steps: { consult: { line: "subject-1" } } } })
            expect(world.asked.map((request) => request.input)).toEqual([{ lines: ["hello"] }, { lines: ["hello", "I paid already"] }])
            expect(world.acts).toEqual([`${STEP_KEY}:cccc`])
            expect(logger.warn).toHaveBeenCalledWith(LanggraphLogEvent.ReplayLeft, { thread: "run-1", position: 1, why: "asks-another" })
        })

        it("tells the same request from one whose members were set in another order, and from one with other words for this call", async () => {
            const { threads } = await build()
            const world = worldOf([false, false, false])
            const requests: Array<NodeModelRequest> = [
                { purpose: "p", instructions: "stable", input: { a: 1, b: 2 } },
                { input: { b: 2, a: 1 }, instructions: "stable", purpose: "p" },
                { purpose: "p", instructions: "stable", volatile: "answered: yes", input: { a: 1, b: 2 } },
            ]
            const pass = { count: 0 }
            const graph = graphOf(async () => {
                const request = requests[pass.count] ?? requests[0]
                pass.count += 1
                if (request !== undefined) await threads.replayPortsOf(world.ports).model.json(DECIDE, request)
                if (pass.count < requests.length) throw failureOf()
                return {}
            })

            await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: FAILURE })
            await expect(threads.drive(THREAD, graph)).rejects.toMatchObject({ code: FAILURE })
            const afterReordered = world.asked.length
            await threads.drive(THREAD, graph)

            expect(afterReordered).toBe(1)
            expect(world.asked).toHaveLength(2)
        })
    })
})

describe("replayRunOf: the model turns of a host's own agent loop, in the same record", () => {
    /** A model turn as a host's loop records it: its name (content included) and the plain answer the model gave. */
    const turnOf = (asked: AskCount, say: string) => (): Promise<{ readonly say: string }> => {
        asked.count += 1
        return Promise.resolve({ say })
    }

    it("records nothing outside the run of a node: every turn asks the model", async () => {
        const { ports } = hostOf()
        const run = replayRunOf((given) => replayPortsOf(given))
        const asked = { count: 0 }

        expect(run.replay(ports)).toBe(ports)
        expect(turnRecordOf(ports)).toBeNull()
        await run.record("p#1:a", turnOf(asked, "one"))
        await run.record("p#1:a", turnOf(asked, "one"))

        expect(asked.count).toBe(2)
    })

    it("does not ask the model again for turns already answered, nor run their door calls again, when the node restarts", async () => {
        const { threads, logger } = await build()
        const host = hostOf()
        const cut = cutOnce()
        const asked = { count: 0 }
        const outputs: Array<unknown> = []
        const graph = graphOf(async () => {
            const run = replayRunOf(threads.replayPortsOf)
            const ports = run.replay(host.ports)
            const first = await run.record("consult:agent#1:aaaa", turnOf(asked, "read the order"))
            const read = await ports.callTool(ORDER_READ, { orderId: "o-1" }, `${STEP_KEY}:bbbb`)
            const second = await run.record("consult:agent#2:bbbb", turnOf(asked, "create it"))
            const order = await ports.execute(ORDER_CREATE, { qty: 1 }, callOf("aaaa"))
            outputs.push({ first, read, second, order })
            cut()
            return { update: { steps: { consult: { order: order.id } } } }
        })

        await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: FAILURE })
        const driven = await threads.drive(THREAD, graph)

        expect(driven.status).toBe("ended")
        expect(asked.count).toBe(2)
        expect(host.seen.tool).toHaveLength(1)
        expect(host.seen.execute).toHaveLength(1)
        expect(outputs[1]).toEqual(outputs[0])
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("asks again from the first turn that would send other words, and makes every call after it live (one record, one mark)", async () => {
        const { threads, logger } = await build()
        const host = hostOf()
        const cut = cutOnce()
        const asked = { count: 0 }
        const pass = { count: 0 }
        const graph = graphOf(async () => {
            pass.count += 1
            const run = replayRunOf(threads.replayPortsOf)
            const ports = run.replay(host.ports)
            await run.record("consult:agent#1:aaaa", turnOf(asked, "read the order"))
            await ports.callTool(ORDER_READ, { orderId: "o-1" }, `${STEP_KEY}:bbbb`)
            // On the second pass the second turn sends other words (another fact, a new line read at the start).
            await run.record(`consult:agent#2:${pass.count === 1 ? "bbbb" : "cccc"}`, turnOf(asked, "create it"))
            await ports.execute(ORDER_CREATE, { qty: 1 }, callOf("aaaa"))
            cut()
            return {}
        })

        await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toMatchObject({ code: FAILURE })
        await threads.drive(THREAD, graph)

        // Turn 1 and the read replay; turn 2 is asked again and the effect after it goes live (the ledger under the port holds it).
        expect(asked.count).toBe(3)
        expect(host.seen.tool).toHaveLength(1)
        expect(host.seen.execute).toHaveLength(2)
        expect(logger.warn).toHaveBeenCalledWith(LanggraphLogEvent.ReplayLeft, { thread: "run-1", position: 2, why: "asks-another" })
    })

    it("never replays a turn that failed: the model's error reaches the loop as thrown and the restart asks again", async () => {
        const { threads } = await build()
        const host = hostOf()
        const failure = new ApprovalRequired({ code: FAILURE })
        const asked = { count: 0 }
        const pass = { count: 0 }
        const caught: Array<unknown> = []
        const graph = graphOf(async () => {
            pass.count += 1
            const run = replayRunOf(threads.replayPortsOf)
            run.replay(host.ports)
            const said = await run
                .record("consult:agent#1:aaaa", () => {
                    asked.count += 1
                    return pass.count === 1 ? Promise.reject(failure) : Promise.resolve({ say: "ok" })
                })
                .catch((cause: unknown) => {
                    caught.push(cause)
                    throw cause
                })
            return { update: { steps: { consult: said } } }
        })

        await expect(threads.start(THREAD, graph, { trigger: null })).rejects.toBe(failure)
        const driven = await threads.drive(THREAD, graph)

        expect(caught).toEqual([failure])
        expect(asked.count).toBe(2)
        expect(driven).toMatchObject({ status: "ended", state: { steps: { consult: { say: "ok" } } } })
    })

    it("keeps only the plain answer of each turn: the record grows by the answers, never by what the turn was sent", async () => {
        const saver = new MemorySaver()
        const { threads } = await build(saver)
        const host = hostOf()
        // What the turn sends: a long transcript. Its name carries a digest of it, never the words.
        const transcript = "x".repeat(20_000)
        const graph = graphOf(async () => {
            const run = replayRunOf(threads.replayPortsOf)
            run.replay(host.ports)
            const answer = { text: "", calls: [{ id: "c-1", name: "sales.order.read", args: { orderId: "o-1" } }] }
            await run.record(`consult:agent#1:${String(transcript.length)}`, () => Promise.resolve(answer))
            return {}
        })

        await threads.start(THREAD, graph, { trigger: null })

        // Every recorded call of the node is a pending write: their bytes together stay far below the step's own output.
        const recorded = Object.values(saver.writes)
            .flatMap((writes) => Object.values(writes))
            .reduce((bytes, [, , value]) => bytes + value.byteLength, 0)
        expect(recorded).toBeGreaterThan(0)
        expect(recorded).toBeLessThan(1_000)
    })
})
