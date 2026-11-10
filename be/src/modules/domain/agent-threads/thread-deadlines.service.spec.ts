import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { RunStopAnswer } from "@nivo-lite/blocks-core/entities"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { GRAPH_THREADS } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadRef, ThreadView } from "@modules/integrations/langgraph"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ThreadDeadlineQueue } from "@modules/queues/thread-deadline"
import type { ThreadDeadlinePayload } from "@modules/queues/thread-deadline"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { AGENT_THREADS_OPTIONS } from "./agent-threads.decorators"
import type { AgentThreadsOptions } from "./agent-threads.options"
import type { RunStop } from "./stops/run-stop.contracts"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import { RunStopsService } from "./stops/run-stops.service"
import { ThreadApprovalsService } from "./thread-approvals.service"
import { ThreadDeadlinesService } from "./thread-deadlines.service"
import { ThreadRunsService } from "./thread-runs.service"
import type { ThreadStoppedListener, ThreadWakeAdmission } from "./thread-runs.service"

const REF: ThreadRef = { workspaceId: "ws-1", runId: "run-1" }
const STOPPED_AT = "2026-11-10T10:00:00.000Z"
const HOUR = 3_600_000

const stopOf = (over: Partial<RunStop> = {}): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-1",
    workflowId: "wf-1",
    leadId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "Không khớp",
    question: "Đây là tiền gì?",
    detail: { suggestions: [], facts: [] },
    cardMessageId: "chat-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: STOPPED_AT,
    resolvedAt: null,
    ...over,
})

const answer = (kind: RunStopAnswer["kind"]): RunStopAnswer => ({ kind, text: null, by: "member-1", at: STOPPED_AT })

/** A flow whose `match` step declares a wait, or none. */
const flowOf = (timeout: string | undefined): GraphSpec =>
    ({
        nodes: [{ key: "match", kind: "action", step: "accounting.match-payment", ...(timeout === undefined ? {} : { wait: { kind: "payment", timeout } }) }],
    }) as unknown as GraphSpec

interface World {
    readonly stop?: RunStop | null
    readonly now?: string
    readonly wait?: string
    readonly admission?: ThreadWakeAdmission
    readonly options?: Partial<AgentThreadsOptions>
    readonly queueless?: boolean
    readonly expired?: Awaited<ReturnType<ThreadApprovalsService["expired"]>>
    readonly open?: ReadonlyArray<RunStop>
}

const build = async (world: World = {}) => {
    const clock = new FakeClock(world.now ?? STOPPED_AT)
    const outbox = jobRecordingOutbox()
    const listeners: Array<ThreadStoppedListener> = []
    const stops = mock<RunStopsService>({ stopOf: jest.fn().mockResolvedValue(world.stop === undefined ? stopOf() : world.stop) })
    const runs = mock<ThreadRunsService>({
        resume: jest.fn().mockResolvedValue(world.admission ?? { kind: "admitted", fresh: true }),
        whenStopped: jest.fn((listener: ThreadStoppedListener) => {
            listeners.push(listener)
        }),
    })
    const view = { version: "version-1" } as unknown as ThreadView
    const port = mock<GraphThreads>({ stateOf: jest.fn().mockResolvedValue(view) })
    const graphs = mock<AgentGraphsService>({
        versionAt: jest.fn().mockResolvedValue({ version: 1, document: { nodes: [], rights: [], flow: flowOf(world.wait) } }),
    })
    const approvals = mock<ThreadApprovalsService>({
        expired: jest.fn().mockResolvedValue(world.expired === undefined ? { kind: "admitted", fresh: true } : world.expired),
    })
    const records = mock<RunStopRecordsService>({ newest: jest.fn().mockResolvedValue(world.open ?? []) })
    const logger = mock<Logger>()
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadDeadlinesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AGENT_THREADS_OPTIONS, useValue: { ...world.options } },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: RunStopsService, useValue: stops },
            { provide: ThreadRunsService, useValue: runs },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GRAPH_THREADS, useValue: port },
            { provide: ThreadApprovalsService, useValue: approvals },
            { provide: RunStopRecordsService, useValue: records },
            ...(world.queueless === true ? [] : [{ provide: ThreadDeadlineQueue, useValue: new ThreadDeadlineQueue(outbox) }]),
        ],
    }).compile()
    const service = moduleRef.get(ThreadDeadlinesService)
    service.onModuleInit()
    return { service, outbox, runs, stops, graphs, approvals, listeners, logger, records }
}

describe("ThreadDeadlinesService", () => {
    describe("arming", () => {
        it("arms a 3-day deadline for a stop that waits for the founder when a drive leaves the thread stopped", async () => {
            const world = await build()

            const [listener] = world.listeners
            await listener?.(REF, "match")

            expect(world.outbox.written).toEqual([
                {
                    queue: "thread_deadline",
                    payload: { workspaceId: "ws-1", runId: "run-1", stepKey: "match", repeats: 1, answered: 0 },
                    job: "thread-deadline.fire",
                    dedupeKey: "thread-deadline:run-1:match:1.0",
                    delayMs: 72 * HOUR,
                },
            ])
        })

        it("arms 24 hours for an approval, the template's wait when the step declares one, and the app's window when set", async () => {
            const approval = await build({ stop: stopOf({ kind: "approval" }) })
            const waited = await build({ wait: "2h" })
            const tuned = await build({ options: { ownerDeadlineMs: 5000 } })

            await approval.service.armed(REF, "match")
            await waited.service.armed(REF, "match")
            await tuned.service.armed(REF, "match")

            expect(approval.outbox.written.map((job) => job.delayMs)).toEqual([24 * HOUR])
            expect(waited.outbox.written.map((job) => job.delayMs)).toEqual([2 * HOUR])
            expect(tuned.outbox.written.map((job) => job.delayMs)).toEqual([5000])
        })

        it("arms nothing for an engine stop, a stop a deadline already answered, a closed stop or an app with no queue", async () => {
            const engine = await build({ stop: stopOf({ kind: "engine" }) })
            const timedOut = await build({ stop: stopOf({ answers: [answer("timeout")] }) })
            const closed = await build({ stop: stopOf({ state: "resolved" }) })
            const queueless = await build({ queueless: true })

            await expect(engine.service.armed(REF, "match")).resolves.toBe("none")
            await expect(timedOut.service.armed(REF, "match")).resolves.toBe("none")
            await expect(closed.service.armed(REF, "match")).resolves.toBe("none")
            await expect(queueless.service.armed(REF, "match")).resolves.toBe("unqueued")
            expect([engine, timedOut, closed].flatMap((one) => one.outbox.written)).toEqual([])
        })

        it("counts the window from the moment the stop last stopped, so a deadline armed late keeps its time", async () => {
            const world = await build({ now: "2026-11-11T10:00:00.000Z" })

            await world.service.armed(REF, "match")

            expect(world.outbox.written.map((job) => job.delayMs)).toEqual([48 * HOUR])
        })
    })

    describe("firing", () => {
        const PAYLOAD = { workspaceId: "ws-1", runId: "run-1", stepKey: "match", repeats: 1, answered: 0 }
        const DUE = "2026-11-13T10:00:00.000Z"

        it("answers the stop `timeout` through the thread runs' resume when it still stands as it was armed for", async () => {
            const world = await build({ now: DUE })

            await expect(world.service.fire(PAYLOAD)).resolves.toBe("admitted")

            expect(world.runs.resume).toHaveBeenCalledWith(REF, { kind: "timeout", at: DUE })
        })

        it("does nothing for a stop already closed, answered or stopped again since, or a deadline not due yet", async () => {
            const closed = await build({ now: DUE, stop: stopOf({ state: "resolved" }) })
            const gone = await build({ now: DUE, stop: null })
            const answered = await build({ now: DUE, stop: stopOf({ answers: [answer("retry")] }) })
            const again = await build({ now: DUE, stop: stopOf({ repeats: 2 }) })
            const early = await build({ now: "2026-11-12T10:00:00.000Z" })

            await expect(closed.service.fire(PAYLOAD)).resolves.toBe("closed")
            await expect(gone.service.fire(PAYLOAD)).resolves.toBe("closed")
            await expect(answered.service.fire(PAYLOAD)).resolves.toBe("moved")
            await expect(again.service.fire(PAYLOAD)).resolves.toBe("moved")
            await expect(early.service.fire(PAYLOAD)).resolves.toBe("early")
            expect([closed, gone, answered, again, early].map((one) => one.runs.resume.mock.calls.length)).toEqual([0, 0, 0, 0, 0])
        })

        it("hands an approval's deadline to the approvals, which close the owner's item and pass the timeout on", async () => {
            const world = await build({ now: "2026-11-11T10:00:00.000Z", stop: stopOf({ kind: "approval" }) })
            const decided = await build({ now: "2026-11-11T10:00:00.000Z", stop: stopOf({ kind: "approval" }), expired: null })

            await expect(world.service.fire(PAYLOAD)).resolves.toBe("admitted")
            await expect(decided.service.fire(PAYLOAD)).resolves.toBe("closed")

            expect(world.approvals.expired).toHaveBeenCalledWith(REF, "match", world.runs)
            expect(world.runs.resume).not.toHaveBeenCalled()
        })

        it("says so when the thread refuses the timeout (it no longer waits for a person)", async () => {
            const world = await build({ now: DUE, admission: { kind: "refused", code: "thread_not_stopped" } })

            await expect(world.service.fire(PAYLOAD)).resolves.toBe("refused")
        })
    })
    describe("run now (the schedule list's \"run now\")", () => {
        const PRESSED: ThreadDeadlinePayload = { workspaceId: "ws-1", runId: "run-1", stepKey: "match", repeats: 1, answered: 0 }

        it("answers the stop `timeout` now, before its deadline, through the same resume; the armed job then finds the stop moved", async () => {
            const world = await build({ now: "2026-11-10T11:00:00.000Z" })

            await expect(world.service.fireNow(PRESSED)).resolves.toBe("admitted")
            // The timeout is the stop's answer now: the armed job (same key) finds the stop moved and does nothing.
            world.stops.stopOf.mockResolvedValue(stopOf({ answers: [answer("timeout")] }))
            await expect(world.service.fire(PRESSED)).resolves.toBe("moved")

            expect(world.runs.resume).toHaveBeenCalledTimes(1)
            expect(world.runs.resume).toHaveBeenCalledWith(REF, { kind: "timeout", at: "2026-11-10T11:00:00.000Z" })
            expect(world.outbox.written).toEqual([])
        })

        it("runs an approval's deadline now through the approvals, and refuses a stop that moved or closed since the list was read", async () => {
            const approval = await build({ stop: stopOf({ kind: "approval" }) })
            const moved = await build({ stop: stopOf({ answers: [answer("timeout")] }) })
            const closed = await build({ stop: stopOf({ state: "resolved" }) })
            const engine = await build({ stop: stopOf({ kind: "engine" }) })

            await expect(approval.service.fireNow(PRESSED)).resolves.toBe("admitted")
            await expect(moved.service.fireNow(PRESSED)).resolves.toBe("moved")
            await expect(closed.service.fireNow(PRESSED)).resolves.toBe("closed")
            await expect(engine.service.fireNow(PRESSED)).resolves.toBe("moved")

            expect(approval.approvals.expired).toHaveBeenCalledWith(REF, "match", approval.runs)
            expect([moved, closed, engine].map((one) => one.runs.resume.mock.calls.length)).toEqual([0, 0, 0])
        })

        it("lists the deadlines of the newest open stops of the workspace, soonest first, leaving out a stop with none", async () => {
            const report = stopOf({ runId: "run-1", stoppedAt: "2026-11-10T10:00:00.000Z" })
            const approval = stopOf({ runId: "run-2", kind: "approval", stoppedAt: "2026-11-10T12:00:00.000Z" })
            const engine = stopOf({ runId: "run-3", kind: "engine" })
            const world = await build({ open: [engine, report, approval] })

            const pending = await world.service.pending("ws-1", 50)

            expect(world.records.newest).toHaveBeenCalledWith("ws-1", "open", 50)
            expect(pending.map(({ stop, deadline }) => [stop.runId, deadline.at.toISOString(), deadline.payload.answered])).toEqual([
                ["run-2", "2026-11-11T12:00:00.000Z", 0],
                ["run-1", "2026-11-13T10:00:00.000Z", 0],
            ])
        })
    })
})
