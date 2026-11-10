import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { coreNodes } from "@nivo-lite/blocks-core"
import { latestTemplateVersion, workflowTemplateOf } from "@nivo-lite/blocks-core/modules"
import { AgentGraphFlowRunsService, AgentGraphsService, AgentWorkflowRunsService } from "@modules/domain/agent-graphs"
import type { FlowThreadRun } from "@modules/domain/agent-graphs"
import { AgentRunsService, AgentRunsViewService } from "@modules/domain/agent-runs"
import { AgentTagService, AgentWakeService, AgentWorkReadService } from "@modules/domain/agent-work"
import type { AgentTurnView, AgentWake } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { GRAPH_THREADS, LanggraphError, LanggraphErrorCode, THREAD_END } from "@modules/integrations/langgraph"
import type {
    GraphThreads,
    OptionalThreadView,
    ThreadGraph,
    ThreadLease,
    ThreadNodeAnswer,
    ThreadNodeScope,
    ThreadOutcome,
    ThreadRef,
    ThreadStart,
    ThreadState,
    ThreadStop,
} from "@modules/integrations/langgraph"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { AGENT_THREADS_OPTIONS } from "./agent-threads.decorators"
import { AgentThreadsErrorCode } from "./errors/agent-threads.error"
import type { RunStop, StopDecision } from "./stops/run-stop.contracts"
import { RunStopsService } from "./stops/run-stops.service"
import { stopAnswerOf, stopRouteOf } from "./stops/stop-gate.policy"
import { FREEZE_NODE, stepExitOf } from "./template-compiler.policy"
import { ThreadGraphsService } from "./thread-graphs.service"
import { ThreadProjectionService } from "./thread-projection.service"
import { THREAD_DRIVE_EVENT, THREAD_RESUME_EVENT, THREAD_WAKE_SOURCE, ThreadRunsService } from "./thread-runs.service"
import { ThreadStepService } from "./thread-step.service"
import type { ThreadGateNode, ThreadStepNode } from "./thread-step.service"

const NOW = "2026-11-10T10:00:00.000Z"
const REF: ThreadRef = { workspaceId: "ws-1", runId: "run-1" }
const FRONT_DESK = "chatbot.front-desk"
const V1 = "version-1"
const V2 = "version-2"

/** The front desk as blocks-core ships it: understand, then four routes. */
const frontDesk = (): GraphSpec => {
    const template = workflowTemplateOf(FRONT_DESK)
    if (template === null) throw new Error("front-desk template missing")
    return latestTemplateVersion(template).graph
}

/** A later version of the front desk whose answer step was renamed: a thread pinned to the first version must never run it. */
const renamed = (): GraphSpec => {
    const flow = frontDesk()
    return {
        ...flow,
        nodes: flow.nodes.map((node) =>
            node.key === "understand"
                ? { ...node, routes: { ...node.routes, question: "reply" } }
                : node.key === "answer"
                  ? { ...node, key: "reply" }
                  : node,
        ),
    }
}

/** What stops a thread inside the fake port: the question a node handed `scope.stop`. */
class Interrupt extends Error {
    constructor(readonly question: object) {
        super("interrupt")
    }
}

/** One thread of the fake port. */
interface FakeThread {
    version: string
    state: ThreadState
    at: string
    stop: ThreadStop | null
}

/**
 * An in-memory `GraphThreads`: it walks the graph it is handed node by node, merges each update, follows each `goto` (refusing one
 * the node did not declare), stops where a node calls `scope.stop` and restarts that node from its first line on `resume`.
 */
class FakeThreads implements GraphThreads {
    readonly threads = new Map<string, FakeThread>()
    readonly leases: Array<ThreadLease | undefined> = []
    readonly calls: Array<string> = []
    /** Answer `busy` to every call, as when this process already drives the thread. */
    busy = false
    /** Throw this from the next call, as when the saver refuses a write. */
    failure: unknown = null
    /** Called once when the next call begins, before any node runs. */
    entered: (() => Promise<void>) | null = null

    readonly replayPortsOf: GraphThreads["replayPortsOf"] = (ports) => ports

    async start(thread: ThreadRef, graph: ThreadGraph, input: ThreadStart, lease?: ThreadLease): Promise<ThreadOutcome> {
        const refused = await this.entering("start", lease)
        if (refused !== null) return refused
        if (this.threads.has(thread.runId)) throw new LanggraphError({ code: LanggraphErrorCode.ThreadExists })
        const made: FakeThread = {
            version: graph.version,
            state: { trigger: input.trigger, steps: {}, trouble: null, founderAnswers: [], loop: null },
            at: graph.entry,
            stop: null,
        }
        this.threads.set(thread.runId, made)
        return this.walk(thread, graph, made, undefined)
    }

    async resume(thread: ThreadRef, graph: ThreadGraph, decision: object, lease?: ThreadLease): Promise<ThreadOutcome> {
        const refused = await this.entering("resume", lease)
        if (refused !== null) return refused
        const found = this.pinned(thread, graph)
        if (found === null) return { status: "absent" }
        if (found.stop === null) throw new LanggraphError({ code: LanggraphErrorCode.ThreadNotStopped })
        found.stop = null
        return this.walk(thread, graph, found, decision)
    }

    async drive(thread: ThreadRef, graph: ThreadGraph, lease?: ThreadLease): Promise<ThreadOutcome> {
        const refused = await this.entering("drive", lease)
        if (refused !== null) return refused
        const found = this.pinned(thread, graph)
        if (found === null) return { status: "absent" }
        if (found.stop !== null) return { status: "stopped", state: found.state, stop: found.stop }
        return this.walk(thread, graph, found, undefined)
    }

    stateOf(thread: ThreadRef): Promise<OptionalThreadView> {
        const found = this.threads.get(thread.runId)
        if (found === undefined) return Promise.resolve(null)
        const ended = found.at === THREAD_END
        return Promise.resolve({
            version: found.version,
            status: found.stop !== null ? "stopped" : ended ? "ended" : "open",
            state: found.state,
            next: ended ? [] : [found.at],
            stop: found.stop,
        })
    }

    private async entering(call: string, lease: ThreadLease | undefined): Promise<ThreadOutcome | null> {
        this.calls.push(call)
        this.leases.push(lease)
        if (this.failure !== null) throw this.failure
        if (this.busy) return { status: "busy" }
        const entered = this.entered
        this.entered = null
        await entered?.()
        return null
    }

    private pinned(thread: ThreadRef, graph: ThreadGraph): FakeThread | null {
        const found = this.threads.get(thread.runId)
        if (found === undefined) return null
        if (found.version !== graph.version) throw new LanggraphError({ code: LanggraphErrorCode.VersionMismatch })
        return found
    }

    private async walk(
        thread: ThreadRef,
        graph: ThreadGraph,
        found: FakeThread,
        decision: object | undefined,
    ): Promise<ThreadOutcome> {
        let pending = decision
        while (found.at !== THREAD_END) {
            const node = graph.nodes.find((candidate) => candidate.key === found.at)
            if (node === undefined) throw new LanggraphError({ code: LanggraphErrorCode.GraphUnsound })
            const scope: ThreadNodeScope = {
                thread,
                node: node.key,
                version: found.version,
                stop: <Decision>(question: object): Decision => {
                    if (pending === undefined) throw new Interrupt(question)
                    const given = pending
                    pending = undefined
                    return given as Decision
                },
            }
            let answer: ThreadNodeAnswer
            try {
                answer = await node.run(found.state, scope)
            } catch (cause) {
                if (!(cause instanceof Interrupt)) throw cause
                found.stop = { node: node.key, question: cause.question }
                return { status: "stopped", state: found.state, stop: found.stop }
            }
            const goto = answer.goto ?? node.next ?? THREAD_END
            if (goto !== THREAD_END && goto !== node.next && !(node.ends ?? []).includes(goto))
                throw new LanggraphError({ code: LanggraphErrorCode.RouteUndeclared })
            const update = answer.update ?? {}
            found.state = {
                ...found.state,
                steps: { ...found.state.steps, ...update.steps },
                ...("trouble" in update ? { trouble: update.trouble } : {}),
                ...(update.founderAnswers === undefined ? {} : { founderAnswers: update.founderAnswers }),
            }
            found.at = goto
        }
        return { status: "ended", state: found.state }
    }
}

/** What a scripted step answers: an output, or `stop` (it cannot complete and goes to the gate). */
type Script = Readonly<Record<string, unknown>>

const STOP = Symbol("stop")

/** What a spec changes of the world. */
interface World {
    /** No threads port composed. */
    readonly portless?: boolean
    /** The engine the run row names. */
    readonly engine?: "legacy" | "langgraph"
    /** The installed node ids; absent installs every blocks-core node. */
    readonly installed?: ReadonlyArray<string>
}

const build = async (world: World = {}) => {
    const port = new FakeThreads()
    /** The step outputs of the script, by step key; the `understand` branch picks the route. */
    const script: { outputs: Script } = { outputs: {} }
    /** Every step that ran, in order, with the founder's words it saw. */
    const ran: Array<{ step: string; answers: ReadonlyArray<unknown>; at: ThreadStepNode }> = []
    let stop: RunStop | null = null
    const stops = mock<RunStopsService>({ stopOf: jest.fn(() => Promise.resolve(stop)) })
    const projection = mock<ThreadProjectionService>({
        runStarted: jest.fn().mockResolvedValue("written"),
        runEnded: jest.fn().mockResolvedValue("written"),
    })
    const steps = mock<ThreadStepService>({
        run: jest.fn((at: ThreadStepNode, state: ThreadState) => {
            ran.push({ step: at.step.key, answers: state.founderAnswers, at })
            const output = script.outputs[at.step.key] ?? {}
            if (output === STOP) {
                stop = {
                    ...(stop ?? { answers: [], repeats: 0 }),
                    id: "stop-1",
                    runId: REF.runId,
                    stepKey: at.step.key,
                    state: "open",
                } as unknown as RunStop
                const trouble = { stepKey: at.step.key, question: { stopId: "stop-1", stepKey: at.step.key }, locale: "vi" }
                return Promise.resolve({ update: { trouble }, goto: FREEZE_NODE })
            }
            return Promise.resolve({
                update: { steps: { [at.step.key]: { output } }, trouble: null },
                goto: stepExitOf(at.step, output),
            })
        }),
        // The real gate's shape: the stop's question, then the decision routed by the stop's own policy.
        gate: jest.fn((_at: ThreadGateNode, state: ThreadState, scope: ThreadNodeScope) => {
            const trouble = state.trouble as { stepKey: string; question: object }
            const decision = scope.stop<StopDecision>(trouble.question)
            const open = stop as RunStop
            const route = stopRouteOf(open, decision, FREEZE_NODE)
            stop = { ...open, answers: [...open.answers, stopAnswerOf(decision)] }
            return Promise.resolve({
                update: { founderAnswers: route.founderAnswers, trouble: route.goto === FREEZE_NODE ? trouble : null },
                goto: route.goto,
            })
        }),
    })
    const flows = mock<AgentGraphFlowRunsService>()
    const versions: Record<string, GraphSpec> = { [V1]: frontDesk(), [V2]: renamed() }
    const graphs = mock<AgentGraphsService>({
        versionAt: jest.fn((_workspaceId: string, _agentId: string, versionId: string) =>
            Promise.resolve({ version: 1, document: { nodes: [], rights: [], flow: versions[versionId] } }),
        ),
    })
    const installed = world.installed ?? coreNodes.map((node) => node.id)
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest.fn(() => ({ nodes: new Map(installed.map((id) => [id, {}])) }) as never),
    })
    const run = runViewOf({ versionId: V1, context: { conversationId: "conv-1", threadScope: "conversation:conv-1" } })
    const runs = mock<AgentRunsService>({
        runOf: jest.fn().mockResolvedValue(run),
        runIdOfWake: jest.fn().mockResolvedValue(run.id),
    })
    const view = mock<AgentRunsViewService>({
        detail: jest.fn().mockResolvedValue({ run: {}, engine: world.engine ?? "langgraph", steps: [] }),
    })
    const written: Array<AgentWake> = []
    const wakes = mock<AgentWakeService>({
        write: jest.fn((_tx: unknown, wake: AgentWake) => {
            const fresh = !written.some((one) => one.eventKey === wake.eventKey)
            if (fresh) written.push(wake)
            return Promise.resolve(fresh ? `wake-${written.length}` : null)
        }),
    })
    const wakeReader = mock<AgentWorkReadService>({
        wakeContextOf: jest.fn((_ws: string, _agent: string, source: string, eventKey: string) =>
            Promise.resolve(written.find((one) => one.source === source && one.eventKey === eventKey)?.context ?? null),
        ),
    })
    const workflows = mock<AgentWorkflowRunsService>({
        workflowKeyOfRun: jest.fn().mockResolvedValue("front-desk"),
        pinsOf: jest.fn().mockResolvedValue([{ runId: "run-1", workflowId: "wf-1", workflowName: "Front desk", version: 4 }]),
    })
    const tags = mock<AgentTagService>()
    const logger = mock<Logger>()
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadRunsService,
            ThreadGraphsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AGENT_THREADS_OPTIONS, useValue: {} },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: AgentGraphFlowRunsService, useValue: flows },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentRunsViewService, useValue: view },
            { provide: AgentWakeService, useValue: wakes },
            { provide: ThreadStepService, useValue: steps },
            { provide: RunStopsService, useValue: stops },
            { provide: ThreadProjectionService, useValue: projection },
            { provide: AgentWorkflowRunsService, useValue: workflows },
            { provide: AgentTagService, useValue: tags },
            { provide: AgentWorkReadService, useValue: wakeReader },
            ...(world.portless === true ? [] : [{ provide: GRAPH_THREADS, useValue: port }]),
        ],
    }).compile()
    const service = moduleRef.get(ThreadRunsService)
    /** The run the flow opened for the customer's wake. */
    const opened = (over: Partial<FlowThreadRun> = {}): FlowThreadRun => ({
        turn: agentTurnViewOf(),
        runId: REF.runId,
        versionId: V1,
        flow: frontDesk(),
        namespace: FRONT_DESK,
        workflowId: "wf-1",
        workflowVersion: 4,
        trigger: { conversationId: "conv-1", text: "Hello shop", missing: undefined },
        ...over,
    })
    /** The wake `resume` or `redrive` last wrote, as the drain hands it back in a turn of the same scope. */
    const turnOfWake = (fence: number): AgentTurnView => {
        const wake = written.at(-1)
        if (wake === undefined) throw new Error("no wake written")
        return agentTurnViewOf({
            source: wake.source,
            eventKey: wake.eventKey,
            context: wake.context,
            scopeKey: wake.scopeKey ?? "agent",
            wakeId: `wake-${written.length}`,
            fence,
        })
    }
    const live = new AbortController().signal
    return { service, port, script, ran, steps, stops, projection, flows, graphs, runs, view, wakes, written, tags, opened, turnOfWake, live }
}

const path = (ran: ReadonlyArray<{ step: string }>): ReadonlyArray<string> => ran.map((one) => one.step)

const DECISION_AT = "2026-11-10T10:05:00.000Z"

describe("ThreadRunsService", () => {
    describe("start → steps → end, under the lease of the wake", () => {
        it.each([
            ["buy", ["understand", "to-consult"]],
            ["paid", ["understand", "to-reconcile"]],
            ["complaint", ["understand", "complaint", "to-owner"]],
            ["question", ["understand", "answer"]],
        ])("walks the front desk's %s route to its end and closes the run as done", async (branch, steps) => {
            const world = await build()
            world.script.outputs = { understand: { branch } }

            const ending = await world.service.started(world.opened(), world.live)

            expect(ending).toEqual({ status: "done", reason: null, outcome: { runId: "run-1" } })
            expect(path(world.ran)).toEqual(steps)
            expect(world.port.calls).toEqual(["start"])
            expect(world.projection.runEnded).toHaveBeenCalledTimes(1)
            expect(world.projection.runEnded).toHaveBeenCalledWith(REF, {
                outcome: "done",
                code: null,
                by: null,
                at: new Date(NOW),
            })
        })

        it("drives under the turn's fence and signal, feeds the trigger as plain JSON, and hands each node its run", async () => {
            const world = await build()
            world.script.outputs = { understand: { branch: "question" } }

            await world.service.started(world.opened(), world.live)

            expect(world.port.leases).toEqual([{ fence: 3, signal: world.live }])
            expect(world.port.threads.get("run-1")?.state.trigger).toEqual({ conversationId: "conv-1", text: "Hello shop" })
            expect(world.ran[0]?.at).toMatchObject({
                agentId: "agent-1",
                versionId: V1,
                namespace: FRONT_DESK,
                workflowId: "wf-1",
            })
            expect(world.ran[0]?.at.replay).toBe(world.port.replayPortsOf)
        })

        it("gives no node a `next`: the node function alone names where the thread goes, the gate included", async () => {
            const world = await build()
            const start = jest.spyOn(world.port, "start")

            await world.service.started(world.opened(), world.live)

            const graph = start.mock.calls[0]?.[1]
            expect(graph?.version).toBe(V1)
            expect(graph?.entry).toBe("understand")
            expect(graph?.nodes.every((node) => node.next === undefined)).toBe(true)
            expect(graph?.nodes.map((node) => node.key)).toEqual([
                "understand",
                "to-consult",
                "to-reconcile",
                "complaint",
                "to-owner",
                "answer",
                FREEZE_NODE,
            ])
            expect(graph?.nodes.find((node) => node.key === "understand")?.ends).toEqual(
                expect.arrayContaining(["to-consult", "to-reconcile", "complaint", "answer", FREEZE_NODE]),
            )
        })

        it("marks the run as a thread's in the transaction that opened it, and refuses to start one it cannot mark", async () => {
            const world = await build()
            const tx = mockEntityManager()

            await world.service.opened(tx, "ws-1", "run-1")
            expect(world.projection.runStarted).toHaveBeenCalledWith(REF, tx)

            world.projection.runStarted.mockResolvedValue("refused")
            await expect(world.service.opened(tx, "ws-1", "run-1")).rejects.toMatchObject({
                code: AgentThreadsErrorCode.RunUnmarked,
            })
        })

        it("continues the thread instead of starting it twice when the wake is tried again", async () => {
            const world = await build()
            world.script.outputs = { understand: { branch: "complaint" } }
            world.steps.run.mockRejectedValueOnce(new Error("the process died"))
            await expect(world.service.started(world.opened(), world.live)).rejects.toThrow("the process died")
            expect(world.projection.runEnded).not.toHaveBeenCalled()

            const again = agentTurnViewOf({ attempts: 2, fence: 4 })
            const ending = await world.service.started(world.opened({ turn: again }), world.live)

            expect(ending.status).toBe("done")
            expect(world.port.calls).toEqual(["start", "drive"])
            expect(world.port.leases[1]).toEqual({ fence: 4, signal: world.live })
            expect(path(world.ran)).toEqual(["understand", "complaint", "to-owner"])
        })
    })

    describe("stop → decision", () => {
        /** A thread stopped at `answer`. */
        const stopped = async () => {
            const world = await build()
            world.script.outputs = { understand: { branch: "question" }, answer: STOP }
            const ending = await world.service.started(world.opened(), world.live)
            return { world, ending }
        }

        it("ends the wake when a step stops, with the run left open for a person", async () => {
            const { world, ending } = await stopped()

            expect(ending).toEqual({ status: "done", reason: null, outcome: { runId: "run-1" } })
            expect(world.projection.runEnded).not.toHaveBeenCalled()
            await expect(world.port.stateOf(REF)).resolves.toMatchObject({ status: "stopped", stop: { node: FREEZE_NODE } })
        })

        it("tells its listeners the step a drive left the thread stopped at; a failing listener never fails the wake", async () => {
            const world = await build()
            const told: Array<string> = []
            world.service.whenStopped(() => Promise.reject(new Error("queue down")))
            world.service.whenStopped((ref, stepKey) => {
                told.push(`${ref.runId}:${stepKey}`)
                return Promise.resolve()
            })
            world.script.outputs = { understand: { branch: "question" }, answer: STOP }

            const ending = await world.service.started(world.opened(), world.live)

            expect(ending).toEqual({ status: "done", reason: null, outcome: { runId: "run-1" } })
            expect(told).toEqual(["run-1:answer"])
        })

        it("tells its settled listeners after a drive that stopped and after one that ended, never failing the wake", async () => {
            const world = await build()
            const settled: Array<string> = []
            world.service.whenSettled(() => Promise.reject(new Error("freezes down")))
            world.service.whenSettled((ref) => {
                settled.push(ref.runId)
                return Promise.resolve()
            })
            world.script.outputs = { understand: { branch: "question" }, answer: STOP }

            await world.service.started(world.opened(), world.live)
            await world.service.resume(REF, { kind: "skip", by: "member-1", at: DECISION_AT })
            await world.service.woken(world.turnOfWake(6), world.live)

            expect(settled).toEqual(["run-1", "run-1"])
        })

        it("writes its wakes under the engine's own `thread` source, and still runs one written under `internal` before it", async () => {
            const { world } = await stopped()

            await world.service.resume(REF, { kind: "retry", by: "member-1", at: DECISION_AT })

            expect(THREAD_WAKE_SOURCE).toBe("thread")
            expect(world.written.map((wake) => wake.source)).toEqual(["thread"])
            const legacy = agentTurnViewOf({ source: "internal", context: { eventName: THREAD_RESUME_EVENT, subjectId: "run-1" } })
            expect(world.service.owns(legacy)).toBe(true)
            expect(world.service.owns(agentTurnViewOf({ source: "schedule", context: legacy.context }))).toBe(false)
        })

        it("writes a decision as a wake of the run's own scope and runs nothing itself", async () => {
            const { world } = await stopped()
            const decision = { kind: "answer", text: "Quote 120k", by: "member-1", at: DECISION_AT }

            await expect(world.service.resume(REF, decision)).resolves.toEqual({ kind: "admitted", fresh: true })

            expect(world.written).toEqual([
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    source: THREAD_WAKE_SOURCE,
                    eventKey: "thread:run-1:answer:0",
                    scopeKey: "conversation:conv-1",
                    context: {
                        eventName: THREAD_RESUME_EVENT,
                        subjectId: "run-1",
                        tagContext: JSON.stringify({ decision, stepKey: "answer", answered: 0 }),
                    },
                    // `member-1` is no member id (uuid): it stays in the payload's decision, never in the actor column.
                    actorMemberId: null,
                },
            ])
            expect(world.port.calls).toEqual(["start"])
            expect(world.service.owns(world.turnOfWake(5))).toBe(true)
            expect(world.service.owns(agentTurnViewOf())).toBe(false)
        })

        it("resumes with an answer: the step runs again with the founder's words and the run ends as done", async () => {
            const { world } = await stopped()
            await world.service.resume(REF, { kind: "answer", text: "Quote 120k", by: "member-1", at: DECISION_AT })
            world.script.outputs = { answer: { sent: true } }

            const ending = await world.service.woken(world.turnOfWake(5), world.live)

            expect(ending.status).toBe("done")
            expect(world.port.calls).toEqual(["start", "resume"])
            expect(world.port.leases[1]).toEqual({ fence: 5, signal: world.live })
            expect(world.ran.at(-1)).toMatchObject({
                step: "answer",
                answers: [{ text: "Quote 120k", at: DECISION_AT }],
                at: { agentId: "agent-1", versionId: V1, namespace: FRONT_DESK, workflowId: "wf-1" },
            })
            expect(world.projection.runEnded).toHaveBeenCalledWith(REF, expect.objectContaining({ outcome: "done" }))
        })

        it("retries: the step runs again with no words added", async () => {
            const { world } = await stopped()
            await world.service.resume(REF, { kind: "retry", by: "member-1", at: DECISION_AT })
            world.script.outputs = { answer: { sent: true } }

            await world.service.woken(world.turnOfWake(5), world.live)

            expect(world.ran.at(-1)).toMatchObject({ step: "answer", answers: [] })
            await expect(world.port.stateOf(REF)).resolves.toMatchObject({ status: "ended" })
        })

        it("skips: the thread ends, the gate's own closing stands, and the right to speak is given back", async () => {
            const { world } = await stopped()
            await world.service.resume(REF, { kind: "skip", by: "member-1", at: DECISION_AT })

            const ending = await world.service.woken(world.turnOfWake(5), world.live)

            expect(ending.status).toBe("done")
            await expect(world.port.stateOf(REF)).resolves.toMatchObject({ status: "ended" })
            expect(path(world.ran)).toEqual(["understand", "answer"])
            expect(world.projection.runEnded).not.toHaveBeenCalled()
            expect(world.tags.release).toHaveBeenCalledWith("ws-1", "conv-1", "agent-1")
        })

        it("takes over: the thread stays at the gate, stopped, and no step runs", async () => {
            const { world } = await stopped()
            await world.service.resume(REF, { kind: "take_over", by: "member-1", at: DECISION_AT })

            const ending = await world.service.woken(world.turnOfWake(5), world.live)

            expect(ending.status).toBe("done")
            await expect(world.port.stateOf(REF)).resolves.toMatchObject({ status: "stopped", stop: { node: FREEZE_NODE } })
            expect(path(world.ran)).toEqual(["understand", "answer"])
            expect(world.projection.runEnded).not.toHaveBeenCalled()
            expect(world.tags.release).not.toHaveBeenCalled()
        })

        it("applies a decision once: its wake tried again, and a second decision for the same stop, never answer a later stop", async () => {
            const { world } = await stopped()
            const retry = { kind: "retry", by: "member-1", at: DECISION_AT }
            await world.service.resume(REF, retry)
            // The same decision for the same stop is the same wake: nothing new is written.
            await expect(world.service.resume(REF, retry)).resolves.toEqual({ kind: "admitted", fresh: false })
            // The retry runs and the step stops again: a new stop state (one answer kept).
            await world.service.woken(world.turnOfWake(5), world.live)
            expect(world.port.calls).toEqual(["start", "resume"])

            // The first wake is delivered again (its turn's end was lost): the stop no longer stands as it did.
            await world.service.woken(world.turnOfWake(6), world.live)

            expect(world.port.calls).toEqual(["start", "resume", "drive"])
            expect(path(world.ran)).toEqual(["understand", "answer", "answer"])
            await expect(world.port.stateOf(REF)).resolves.toMatchObject({ status: "stopped" })
        })

        it("serialises two concurrent decisions on one stop: the first wins and is applied once, the other is refused as already answered", async () => {
            const { world } = await stopped()
            const words = { kind: "answer", text: "Quote 120k", by: "member-1", at: DECISION_AT }
            const skip = { kind: "skip", by: "member-2", at: DECISION_AT }

            const [first, second] = await Promise.all([world.service.resume(REF, words), world.service.resume(REF, skip)])

            expect(first).toEqual({ kind: "admitted", fresh: true })
            expect(second).toEqual({ kind: "refused", code: "already_answered" })
            expect(world.written).toHaveLength(1)
            await expect(world.service.resume(REF, words)).resolves.toEqual({ kind: "admitted", fresh: false })

            await world.service.woken(world.turnOfWake(7), world.live)
            await world.service.woken(world.turnOfWake(8), world.live)

            // The step ran once before the stop and ONCE more with the winner's words: the second wake applied nothing.
            expect(world.ran.filter((one) => one.step === "answer").map((one) => one.answers.length)).toEqual([0, 1])
            expect(world.projection.runEnded).not.toHaveBeenCalledWith(REF, expect.objectContaining({ outcome: "skipped" }))
        })

        it("puts only a member id (uuid) in the wake's actor column; any other `by` stays in the payload alone", async () => {
            const { world } = await stopped()
            const member = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b"

            await world.service.resume(REF, { kind: "retry", by: member, at: DECISION_AT })
            const first = world.written.at(-1)

            expect(first?.actorMemberId).toBe(member)
            const timeout = await build()
            timeout.script.outputs = { understand: { branch: "question" }, answer: STOP }
            await timeout.service.started(timeout.opened(), timeout.live)
            await timeout.service.resume(REF, { kind: "skip", by: "engine:approvals", at: DECISION_AT })
            const engine = timeout.written.at(-1)
            expect(engine?.actorMemberId).toBeNull()
            expect(engine?.context.tagContext).toContain('"by":"engine:approvals"')
        })

        it("refuses what is no decision, and a thread that waits for nobody, with nothing written", async () => {
            const { world } = await stopped()
            await expect(world.service.resume(REF, { kind: "approve" })).resolves.toEqual({
                kind: "refused",
                code: "decision_invalid",
            })

            const ended = await build()
            await ended.service.started(ended.opened(), ended.live)
            await expect(
                ended.service.resume(REF, { kind: "retry", by: "member-1", at: DECISION_AT }),
            ).resolves.toEqual({ kind: "refused", code: "thread_not_stopped" })
            await expect(ended.service.redrive(REF, "sweep-1")).resolves.toEqual({ kind: "refused", code: "thread_ended" })
            expect(world.written).toEqual([])
            expect(ended.written).toEqual([])
        })

        it("re-drives a thread whose drive was cut through a wake of its scope, and never moves a stopped one", async () => {
            const world = await build()
            world.script.outputs = { understand: { branch: "question" } }
            world.steps.run.mockRejectedValueOnce(new Error("the process died"))
            await expect(world.service.started(world.opened(), world.live)).rejects.toThrow()

            await expect(world.service.redrive(REF, "sweep-1")).resolves.toEqual({ kind: "admitted", fresh: true })
            expect(world.written[0]).toMatchObject({
                eventKey: "thread:run-1:drive:sweep-1",
                scopeKey: "conversation:conv-1",
                context: { eventName: THREAD_DRIVE_EVENT, subjectId: "run-1" },
            })
            await world.service.woken(world.turnOfWake(7), world.live)
            expect(world.port.calls).toEqual(["start", "drive"])
            expect(path(world.ran)).toEqual(["understand", "answer"])

            const { world: frozen } = await stopped()
            await frozen.service.redrive(REF, "sweep-1")
            await frozen.service.woken(frozen.turnOfWake(7), frozen.live)
            expect(path(frozen.ran)).toEqual(["understand", "answer"])
            await expect(frozen.port.stateOf(REF)).resolves.toMatchObject({ status: "stopped" })
        })
    })

    describe("one driver per thread", () => {
        it("refuses a second driver while the thread is driven: it runs nothing and its wake is tried again", async () => {
            const world = await build()
            let second: Promise<unknown> = Promise.resolve()
            world.port.entered = () => {
                second = world.service
                    .started(world.opened({ turn: agentTurnViewOf({ fence: 4 }) }), world.live)
                    .catch((cause: unknown) => cause)
                return Promise.resolve()
            }

            const first = await world.service.started(world.opened(), world.live)

            expect(first.status).toBe("done")
            await expect(second).resolves.toMatchObject({ code: AgentThreadsErrorCode.Busy })
            expect(world.port.calls).toEqual(["start"])
            expect(world.projection.runEnded).toHaveBeenCalledTimes(1)
        })

        it("rejects the wake when the port says the thread is busy, and writes no row", async () => {
            const world = await build()
            world.port.busy = true

            await expect(world.service.started(world.opened(), world.live)).rejects.toMatchObject({
                code: AgentThreadsErrorCode.Busy,
            })
            expect(world.ran).toEqual([])
            expect(world.projection.runEnded).not.toHaveBeenCalled()
        })

        it("drives nothing when the lease is already lost", async () => {
            const world = await build()
            const lost = new AbortController()
            lost.abort()

            await expect(world.service.started(world.opened(), lost.signal)).rejects.toMatchObject({
                code: AgentThreadsErrorCode.LeaseLost,
            })
            expect(world.port.calls).toEqual([])
        })

        it("lets a fenced write surface and writes no row: the superseded driver stops there", async () => {
            const world = await build()
            world.port.failure = new LanggraphError({ code: LanggraphErrorCode.CheckpointFenced })

            await expect(world.service.started(world.opened(), world.live)).rejects.toMatchObject({
                code: LanggraphErrorCode.CheckpointFenced,
            })
            expect(world.projection.runEnded).not.toHaveBeenCalled()
            // The driver is released: the next holder of the lease is not refused as busy.
            world.port.failure = null
            await expect(world.service.started(world.opened(), world.live)).resolves.toMatchObject({ status: "done" })
        })
    })

    describe("the pinned version", () => {
        it("resumes a thread on the version it started on after a new version was published", async () => {
            const world = await build()
            world.script.outputs = { understand: { branch: "question" }, answer: STOP }
            await world.service.started(world.opened(), world.live)
            await world.service.resume(REF, { kind: "retry", by: "member-1", at: DECISION_AT })
            world.script.outputs = { answer: { sent: true } }
            const resume = jest.spyOn(world.port, "resume")

            await world.service.woken(world.turnOfWake(5), world.live)

            expect(resume.mock.calls[0]?.[1].version).toBe(V1)
            expect(path(world.ran)).toEqual(["understand", "answer", "answer"])
            await expect(world.port.stateOf(REF)).resolves.toMatchObject({ status: "ended", version: V1 })
        })

        it("continues a wake tried again on the thread's version, read by its id, when the route now names a newer one", async () => {
            const world = await build()
            world.script.outputs = { understand: { branch: "question" } }
            world.steps.run.mockRejectedValueOnce(new Error("the process died"))
            await expect(world.service.started(world.opened(), world.live)).rejects.toThrow()
            const drive = jest.spyOn(world.port, "drive")

            await world.service.started(world.opened({ versionId: V2, flow: renamed() }), world.live)

            expect(drive.mock.calls[0]?.[1].version).toBe(V1)
            expect(path(world.ran)).toEqual(["understand", "answer"])
        })

        it("reads a version it has not built by its id, and builds each version once", async () => {
            const world = await build()
            world.script.outputs = { understand: { branch: "question" }, answer: STOP }
            await world.service.started(world.opened(), world.live)
            await world.service.resume(REF, { kind: "retry", by: "member-1", at: DECISION_AT })
            await world.service.woken(world.turnOfWake(5), world.live)
            // Built at the start from the routed flow: the resume found it by version id and read nothing.
            expect(world.graphs.versionAt).not.toHaveBeenCalled()

            // Another process (nothing built yet) continues the same thread: it reads the pinned version by id.
            const other = await build()
            other.port.threads.set("run-1", world.port.threads.get("run-1") as never)
            await other.service.redrive(REF, "sweep-1")
            await other.service.woken(other.turnOfWake(6), other.live)
            expect(other.graphs.versionAt).toHaveBeenCalledWith("ws-1", "agent-1", V1)
        })

        it("refuses by name a version whose step is not installed, and closes the run as failed", async () => {
            const world = await build({ installed: ["chatbot.understand"] })

            await expect(world.service.started(world.opened(), world.live)).rejects.toMatchObject({
                code: AgentThreadsErrorCode.TemplateRefused,
                params: { version: V1, problem: "TEMPLATE_STEP_UNKNOWN" },
            })
            expect(world.port.calls).toEqual([])
            expect(world.projection.runEnded).toHaveBeenCalledWith(
                REF,
                expect.objectContaining({ outcome: "failed", code: "TEMPLATE_STEP_UNKNOWN" }),
            )
        })
    })

    describe("the flag and the engine of a run", () => {
        it("registers with the flow when the app has a threads port", async () => {
            const on = await build()
            on.service.onModuleInit()
            expect(on.flows.setThreads).toHaveBeenCalledWith(on.service)
        })

        it("does not start an app that composed the thread runs but no threads port, and stays out of the flow", async () => {
            const world = await build({ portless: true })

            expect(() => world.service.onModuleInit()).toThrow(
                expect.objectContaining({ code: AgentThreadsErrorCode.PortMissing }),
            )
            expect(world.flows.setThreads).not.toHaveBeenCalled()
        })

        it("never picks up a run of the old engine: no wake is written for it and a wake that names it moves nothing", async () => {
            const world = await build({ engine: "legacy" })

            await expect(
                world.service.resume(REF, { kind: "retry", by: "member-1", at: DECISION_AT }),
            ).resolves.toEqual({ kind: "refused", code: "run_not_thread" })
            await expect(world.service.redrive(REF, "sweep-1")).resolves.toEqual({ kind: "refused", code: "run_not_thread" })
            const wake = agentTurnViewOf({
                source: THREAD_WAKE_SOURCE,
                context: { eventName: THREAD_DRIVE_EVENT, subjectId: "run-1" },
            })
            await expect(world.service.woken(wake, world.live)).resolves.toEqual({
                status: "skipped",
                reason: "thread_run_legacy",
                outcome: null,
            })
            expect(world.written).toEqual([])
            expect(world.port.calls).toEqual([])
        })
    })
})
