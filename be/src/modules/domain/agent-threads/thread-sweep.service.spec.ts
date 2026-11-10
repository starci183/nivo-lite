import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { agentRunEntity, agentRunStepEntity, agentRunStopEntity } from "@nivo-lite/blocks-core/entities"
import { AgentWorkReadService } from "@modules/domain/agent-work"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { WorkspacesService } from "@modules/domain/workspaces"
import { GRAPH_THREADS } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadView } from "@modules/integrations/langgraph"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AGENT_THREADS_OPTIONS } from "./agent-threads.decorators"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import type { RunStop } from "./stops/run-stop.contracts"
import { RunStopsService } from "./stops/run-stops.service"
import { ThreadDeadlinesService } from "./thread-deadlines.service"
import type { StopDeadline } from "./thread-deadlines.service"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadRunsService } from "./thread-runs.service"
import type { ThreadWakeAdmission } from "./thread-runs.service"
import { ThreadSweepService, threadPositionOf } from "./thread-sweep.service"

const NOW = "2026-11-10T10:00:00.000Z"
const STILL = "2026-11-10T09:50:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-1" }

const runRow = (over: Partial<RecordRow["data"]> = {}, updatedAt = STILL): RecordRow => ({
    id: "run-1",
    workspaceId: "ws-1",
    version: "3",
    createdAt: STILL,
    updatedAt,
    data: { agentId: "agent-1", wakeId: "wake-1", status: "running", engine: "langgraph", ...over },
})

const viewOf = (status: ThreadView["status"], over: Partial<ThreadView> = {}): ThreadView => ({
    version: "version-1",
    status,
    state: { trigger: { conversationId: "conv-1" }, steps: { understand: {} }, trouble: null, founderAnswers: [], loop: null },
    next: status === "open" ? ["answer"] : [],
    stop: null,
    ...over,
})

const stopOf = (over: Partial<RunStop> = {}): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "answer",
    agentId: "agent-1",
    workflowId: null,
    leadId: null,
    conversationId: "conv-1",
    kind: "ai_report",
    state: "open",
    reason: "r",
    question: null,
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: STILL,
    resolvedAt: null,
    ...over,
})

/** The row data of a stop as the entity keeps it, so the sweep's list reads it back through `runStopOf`. */
const stopRow = (stop: RunStop): RecordRow => ({
    id: stop.id,
    workspaceId: "ws-1",
    version: stop.version,
    createdAt: stop.stoppedAt,
    updatedAt: stop.stoppedAt,
    data: {
        ...stop,
        customerLines: { lines: stop.customerLines },
        answers: { answers: stop.answers },
    },
})

interface World {
    readonly runs?: ReadonlyArray<RecordRow>
    readonly view?: ThreadView | null
    readonly live?: boolean
    readonly redrive?: ThreadWakeAdmission
    readonly openStops?: ReadonlyArray<RunStop>
    readonly ofRun?: ReadonlyArray<RunStop>
    readonly runStatus?: string | null
    readonly stepRows?: ReadonlyArray<RecordRow>
    readonly deadline?: StopDeadline | null
    readonly reader?: boolean
    readonly workflows?: ReadonlyArray<string>
}

const build = async (world: World = {}) => {
    const tx = mock<ScopedTx>()
    const queries: Array<Query> = []
    const list = (_tx: ScopedTx, query: Query) => {
        queries.push(query)
        const rows =
            query.from === "agent.run"
                ? JSON.stringify(query.where).includes('"running"')
                    ? (world.runs ?? [])
                    : []
                : query.from === "agent.run-stop"
                  ? (world.openStops ?? []).map(stopRow)
                  : (world.stepRows ?? [])
        return Promise.resolve({ rows: rows.map((row) => ({ row })), next: null })
    }
    const engine = mock<EntityEngineService>({
        // The engine's generic signatures take no plain double; the world only needs these three reads.
        scoped: ((_ws: string, work: (scoped: ScopedTx) => unknown) => Promise.resolve(work(tx))) as never,
        list: list as never,
        get: jest.fn(() =>
            Promise.resolve(
                world.runStatus === null ? null : { ...runRow(), data: { ...runRow().data, status: world.runStatus ?? "waiting" } },
            ),
        ),
    })
    const port = mock<GraphThreads>({ stateOf: jest.fn().mockResolvedValue(world.view === undefined ? viewOf("open") : world.view) })
    const records = mock<RunStopRecordsService>({ ofRun: jest.fn().mockResolvedValue(world.ofRun ?? []) })
    const stops = mock<RunStopsService>({
        runClosed: jest.fn().mockResolvedValue(1),
        stopOf: jest.fn().mockResolvedValue(stopOf({ stoppedAt: "2026-11-10T09:40:00.000Z" })),
    })
    const projection = mock<ThreadProjectionService>({
        runEnded: jest.fn().mockResolvedValue("written"),
        repair: jest.fn().mockResolvedValue("written"),
    })
    const runs = mock<ThreadRunsService>({
        redrive: jest.fn().mockResolvedValue(world.redrive ?? { kind: "admitted", fresh: true }),
    })
    const deadlines = mock<ThreadDeadlinesService>({
        dueOf: jest.fn().mockResolvedValue(world.deadline ?? null),
        fire: jest.fn().mockResolvedValue("admitted"),
        armed: jest.fn().mockResolvedValue("armed"),
    })
    const wakes = mock<AgentWorkReadService>({ hasLiveWake: jest.fn().mockResolvedValue(world.live ?? false) })
    const workspaces = mock<WorkspacesService>({ list: jest.fn().mockResolvedValue([{ id: "ws-1", name: "Shop" }]) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadSweepService,
            { provide: AGENT_THREADS_OPTIONS, useValue: { workflows: world.workflows ?? ["chatbot.front-desk"] } },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: EntityEngineService, useValue: engine },
            { provide: RunStopRecordsService, useValue: records },
            { provide: RunStopsService, useValue: stops },
            { provide: ThreadProjectionService, useValue: projection },
            { provide: ThreadRunsService, useValue: runs },
            { provide: ThreadDeadlinesService, useValue: deadlines },
            { provide: GRAPH_THREADS, useValue: port },
            { provide: WorkspacesService, useValue: workspaces },
            ...(world.reader === false ? [] : [{ provide: AgentWorkReadService, useValue: wakes }]),
        ],
    }).compile()
    return { service: moduleRef.get(ThreadSweepService), engine, queries, port, records, stops, projection, runs, deadlines, wakes, logger }
}

describe("ThreadSweepService", () => {
    describe("crashed threads", () => {
        it("re-drives a thread with unfinished work, no interrupt and no live wake, once per position", async () => {
            const world = await build({ runs: [runRow()] })

            const report = await world.service.sweep()

            expect(report).toEqual({ redriven: 1, repaired: 0, abandoned: 0, closed: 0, fired: 0 })
            expect(world.wakes.hasLiveWake).toHaveBeenCalledWith("ws-1", "agent-1", { wakeId: "wake-1", subjectId: "run-1" })
            expect(world.runs.redrive).toHaveBeenCalledWith(REF, threadPositionOf(viewOf("open")))
            expect(threadPositionOf(viewOf("open"))).toBe("1.answer.0")
        })

        it("never re-drives a stopped (interrupted) thread, whatever its stop came from, an outcome-unknown code included", async () => {
            const view = viewOf("stopped", { stop: { node: "__freeze", question: { stepKey: "answer", reason: "tool_outcome_unknown" } } })
            const world = await build({ runs: [runRow({ status: "waiting" })], view })

            await world.service.sweep()

            expect(world.runs.redrive).not.toHaveBeenCalled()
            expect(world.projection.repair).not.toHaveBeenCalled()
        })

        it("leaves a thread alone while a wake that could move it is alive, its row moved lately, or no wake reader is composed", async () => {
            const live = await build({ runs: [runRow()], live: true })
            const fresh = await build({ runs: [runRow({}, "2026-11-10T09:59:30.000Z")] })
            const blind = await build({ runs: [runRow()], reader: false })

            await live.service.sweep()
            await fresh.service.sweep()
            await blind.service.sweep()

            expect([live, fresh, blind].map((one) => one.runs.redrive.mock.calls.length)).toEqual([0, 0, 0])
        })

        it("closes as failed a run re-driven from the same place before whose wake is gone, and closes its stops", async () => {
            const world = await build({ runs: [runRow()], redrive: { kind: "admitted", fresh: false } })

            const report = await world.service.sweepWorkspace("ws-1")

            expect(report.abandoned).toBe(1)
            expect(world.projection.runEnded).toHaveBeenCalledWith(REF, {
                outcome: "failed",
                code: "thread_redrive_exhausted",
                by: null,
                at: new Date(NOW),
            })
            expect(world.stops.runClosed).toHaveBeenCalledWith(REF, { locale: "vi" })
        })

        it("closes as failed a run whose thread never got a checkpoint once no wake can start it any more", async () => {
            const world = await build({ runs: [runRow()], view: null })
            const waiting = await build({ runs: [runRow()], view: null, live: true })

            await world.service.sweepWorkspace("ws-1")
            await waiting.service.sweepWorkspace("ws-1")

            expect(world.projection.runEnded).toHaveBeenCalledWith(REF, expect.objectContaining({ outcome: "failed", code: "thread_never_started" }))
            expect(waiting.projection.runEnded).not.toHaveBeenCalled()
        })
    })

    describe("projection repair", () => {
        it("closes the row of a thread that ended as done, or as skipped by the founder whose decision the stop keeps", async () => {
            const done = await build({ runs: [runRow()], view: viewOf("ended") })
            const skip = { kind: "skip" as const, text: null, by: "member-1", at: "2026-11-10T09:30:00.000Z" }
            const skipped = await build({ runs: [runRow()], view: viewOf("ended"), ofRun: [stopOf({ state: "resolved", decision: skip })] })

            await expect(done.service.sweepWorkspace("ws-1")).resolves.toMatchObject({ repaired: 1 })
            await skipped.service.sweepWorkspace("ws-1")

            expect(done.projection.runEnded).toHaveBeenCalledWith(REF, { outcome: "done", code: null, by: null, at: new Date(NOW) })
            expect(skipped.projection.runEnded).toHaveBeenCalledWith(REF, {
                outcome: "skipped",
                code: "skipped_by_founder",
                by: "member-1",
                at: new Date(skip.at),
            })
        })

        it("writes the stop's step fact again from the step row when a stopped thread's run still reads running", async () => {
            const view = viewOf("stopped", { stop: { node: "__freeze", question: { stepKey: "answer" } } })
            const step: RecordRow = {
                ...runRow(),
                id: "step-1",
                data: {
                    stepKey: "answer",
                    nodeKey: "answer",
                    kind: "graph_node",
                    effect: { kind: "pivot" },
                    input: { versionId: "version-1" },
                    ordinal: 2,
                    attempt: 1,
                    errorCode: "ai_report",
                    error: { code: "ai_report" },
                    waitItemId: null,
                },
            }
            const world = await build({ runs: [runRow()], view, stepRows: [step] })

            await world.service.sweepWorkspace("ws-1")

            expect(world.projection.repair).toHaveBeenCalledWith(REF, {
                steps: [
                    {
                        kind: "stopped",
                        spec: {
                            stepKey: "answer",
                            nodeKey: "answer",
                            kind: "graph_node",
                            effect: { kind: "pivot" },
                            input: { versionId: "version-1" },
                        },
                        ordinal: 2,
                        attempt: 1,
                        at: new Date("2026-11-10T09:40:00.000Z"),
                        code: "ai_report",
                        error: { code: "ai_report" },
                        calls: [],
                        waitItemId: null,
                    },
                ],
                end: null,
            })
            expect(world.runs.redrive).not.toHaveBeenCalled()
        })
    })

    describe("open stops", () => {
        const DEADLINE: StopDeadline = {
            at: new Date("2026-11-10T09:55:00.000Z"),
            payload: { workspaceId: "ws-1", runId: "run-1", stepKey: "answer", repeats: 1, answered: 0 },
        }

        it("closes the open stops of a run that is closed (no live button on a failed run)", async () => {
            const world = await build({ runs: [], openStops: [stopOf()], runStatus: "failed" })

            await expect(world.service.sweepWorkspace("ws-1")).resolves.toMatchObject({ closed: 1 })
            expect(world.stops.runClosed).toHaveBeenCalledWith(REF, { locale: "vi" })
        })

        it("fires a deadline whose job has not, and arms the deadline of a stop the drive did not arm", async () => {
            const due = await build({ runs: [], openStops: [stopOf()], deadline: DEADLINE })
            const later = await build({
                runs: [],
                openStops: [stopOf()],
                deadline: { ...DEADLINE, at: new Date("2026-11-13T09:50:00.000Z") },
            })

            await expect(due.service.sweepWorkspace("ws-1")).resolves.toMatchObject({ fired: 1 })
            await later.service.sweepWorkspace("ws-1")

            expect(due.deadlines.fire).toHaveBeenCalledWith(DEADLINE.payload)
            expect(later.deadlines.fire).not.toHaveBeenCalled()
            expect(later.deadlines.armed).toHaveBeenCalledWith(REF, "answer")
        })
    })

    it("sends only queries the entity engine accepts: every list is served by a declared index", async () => {
        const view = viewOf("stopped", { stop: { node: "__freeze", question: { stepKey: "answer" } } })
        const world = await build({ runs: [runRow()], view, openStops: [stopOf()] })
        const catalog = new Map([agentRunEntity, agentRunStepEntity, agentRunStopEntity].map((entity) => [entity.name, entity]))

        await world.service.sweepWorkspace("ws-1")

        const { queries } = world
        expect(new Set(queries.map((query) => query.from))).toEqual(new Set(["agent.run", "agent.run-step", "agent.run-stop"]))
        expect(queries.flatMap((query) => queryProblems(query, catalog))).toEqual([])
    })

    it("runs the passes that ride it once per workspace, after its own, and survives a failing one", async () => {
        const world = await build({ runs: [] })
        const rode: Array<string> = []
        world.service.alsoPerWorkspace(() => Promise.reject(new Error("freezes down")))
        world.service.alsoPerWorkspace((workspaceId) => {
            rode.push(workspaceId)
            return Promise.resolve()
        })

        await world.service.sweep()

        expect(rode).toEqual(["ws-1"])
        expect(world.logger.error).toHaveBeenCalledTimes(1)
    })

    it("reads nothing at all while no workflow is on threads", async () => {
        const world = await build({ runs: [runRow()], openStops: [stopOf()], workflows: [] })

        await expect(world.service.sweep()).resolves.toEqual({ redriven: 0, repaired: 0, abandoned: 0, closed: 0, fired: 0 })

        expect(world.queries).toEqual([])
        expect(world.port.stateOf).not.toHaveBeenCalled()
        expect(world.wakes.hasLiveWake).not.toHaveBeenCalled()
    })

    it("keeps going when one item fails, and does nothing in an app with no threads port", async () => {
        const world = await build({ runs: [runRow(), { ...runRow(), id: "run-2" }] })
        world.port.stateOf.mockRejectedValueOnce(new Error("db down"))

        await expect(world.service.sweepWorkspace("ws-1")).resolves.toMatchObject({ redriven: 1 })
        expect(world.logger.error).toHaveBeenCalledTimes(1)
    })
})
