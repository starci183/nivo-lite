import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { WHEN, runRecordOf, runStepViewOf, runViewOf, stepRecordOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunParkStoreService } from "./agent-run-park-store.service"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { ResumeWrite } from "./agent-runs-engine.contracts"

const scoped = mock<ScopedTx>({ workspaceId: "ws-1" })

const build = async () => {
    const em: MockEntityManager = mockEntityManager()
    fakeTransaction(em)
    const store = mock<AgentRunStoreService>()
    store.at.mockImplementation((_ws, _manager, work) => work(scoped))
    const records = mock<AgentRunRecordsService>()
    const queue = mock<AgentStepQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunParkStoreService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(WHEN) },
            { provide: AgentRunStoreService, useValue: store },
            { provide: AgentRunRecordsService, useValue: records },
            { provide: AgentStepQueue, useValue: queue },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRunParkStoreService), store, records, queue }
}

const REQUEST: ResumeWrite = {
    workspaceId: "ws-1",
    runId: "run-1",
    actor: "member-1",
    reason: "fixed",
    auto: false,
    max: 5,
    backoffSeconds: 60,
}

const failed = stepRecordOf({ stepKey: "send", status: "failed", errorCode: "boom", attempt: 3 })

describe("AgentRunParkStoreService reads and notes", () => {
    it("reads the first failed step of a run, or null", async () => {
        const { service, store } = await build()
        store.stepsOf.mockResolvedValueOnce([
            runStepViewOf({ stepKey: "a", status: "done" }),
            runStepViewOf({ stepKey: "b", status: "failed" }),
        ])
        store.stepsOf.mockResolvedValueOnce([])

        await expect(service.failedStepOf("ws-1", "run-1")).resolves.toMatchObject({ stepKey: "b" })
        await expect(service.failedStepOf("ws-1", "run-1")).resolves.toBeNull()
    })

    it("notes the build only on a run that is parked", async () => {
        const { service, store } = await build()
        const wrote: Array<unknown> = []
        store.patchRunWith.mockImplementation(async (_scoped, _runId, builder) => {
            wrote.push(await builder(runRecordOf({ status: "parked" })), await builder(runRecordOf()))
            return runRecordOf()
        })

        await expect(service.markParked("ws-1", "run-1", "build-9")).resolves.toBe(true)
        expect(wrote).toEqual([{ parkedBuild: "build-9" }, null])
    })

    it("answers false when nothing was noted", async () => {
        const { service, store } = await build()
        store.patchRunWith.mockResolvedValue(null)

        await expect(service.markParked("ws-1", "run-1", "build-9")).resolves.toBe(false)
    })
})

describe("AgentRunParkStoreService resumeRun", () => {
    it.each([
        ["not_found", null, "not_found"],
        ["compensated", runRecordOf({ status: "compensated" }), "compensated"],
        ["compensating", runRecordOf({ status: "compensating" }), "compensated"],
        ["not_parked", runRecordOf({ status: "running" }), "not_parked"],
    ])("answers %s without a write or a job", async (_name, run, kind) => {
        const { service, records, queue } = await build()
        records.run.mockResolvedValue(run)

        await expect(service.resumeRun(REQUEST)).resolves.toEqual({ kind })
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })

    it("answers no_failed_step, and exhausted for a machine past its tries", async () => {
        const { service, records } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "parked", resumeAttempts: 5 }))
        records.stepsOf.mockResolvedValueOnce([stepRecordOf()])
        await expect(service.resumeRun(REQUEST)).resolves.toEqual({ kind: "no_failed_step" })

        records.stepsOf.mockResolvedValue([failed])
        await expect(service.resumeRun({ ...REQUEST, auto: true })).resolves.toEqual({ kind: "exhausted" })
    })

    it("puts a person's resume back on the failed step with the job that drives it", async () => {
        const { service, records, store, queue } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "parked" }))
        records.stepsOf.mockResolvedValue([stepRecordOf(), failed])
        records.patchStep.mockResolvedValue(failed)
        const wrote: Array<unknown> = []
        store.patchRunWith.mockImplementation(async (_scoped, _runId, builder) => {
            wrote.push(await builder(runRecordOf({ status: "parked", resumeAttempts: 2 })))
            return runRecordOf()
        })

        const answer = await service.resumeRun({ ...REQUEST, input: { scope: "x" } })

        expect(answer).toEqual({
            kind: "resumed",
            stepKey: "send",
            workspaceId: "ws-1",
            errorCode: "boom",
            at: WHEN.getTime(),
        })
        expect(records.patchStep).toHaveBeenCalledWith(scoped, failed, {
            status: "pending",
            attempt: 0,
            errorCode: null,
            claimedUntil: null,
            waitItemId: null,
            notBefore: WHEN.toISOString(),
            input: { scope: "x" },
        })
        expect(wrote).toEqual([
            {
                status: "running",
                error: null,
                parkReason: null,
                endedAt: null,
                deadLetteredAt: null,
                resumedAt: WHEN.toISOString(),
                resumedBy: "member-1",
                resumeReason: "fixed",
                resumeAttempts: 2,
            },
        ])
        expect(queue.enqueueAdvance).toHaveBeenCalledWith(
            { workspaceId: "ws-1", runId: "run-1" },
            "send",
            `resume-${String(WHEN.getTime())}`,
            expect.anything(),
        )
    })
})

describe("AgentRunParkStoreService resumeRun by the machine", () => {
    it("counts a machine resume and spaces the next one by a doubling pause, keeping the stored input when none is given or it is not JSON", async () => {
        const { service, records, store } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "parked" }))
        records.stepsOf.mockResolvedValue([failed])
        records.patchStep.mockResolvedValue(failed)
        const wrote: Array<unknown> = []
        store.patchRunWith.mockImplementation(async (_scoped, _runId, builder) => {
            wrote.push(await builder(runRecordOf({ status: "parked", resumeAttempts: 2 })))
            return runRecordOf()
        })

        await service.resumeRun({ ...REQUEST, auto: true, input: { bad: () => 1 } })
        await service.resumeRun({ ...REQUEST, auto: true })

        expect(records.patchStep.mock.calls[0]?.[2]).not.toHaveProperty("input")
        expect(records.patchStep.mock.calls[1]?.[2]).not.toHaveProperty("input")
        expect(wrote[0]).toMatchObject({
            resumeAttempts: 3,
            resumeNotBefore: new Date(WHEN.getTime() + 60_000 * 4).toISOString(),
        })
    })

    it("tells the caller to try again when the failed step moved first", async () => {
        const { service, records } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "parked" }))
        records.stepsOf.mockResolvedValue([failed])
        records.patchStep.mockResolvedValue(null)

        await expect(service.resumeRun(REQUEST)).rejects.toMatchObject({ code: "AGENT_RUNS_RUN_CONTENDED" })
    })
})

describe("AgentRunParkStoreService parked", () => {
    const QUERY = {
        workspaceId: "ws-1",
        limit: 2,
        build: "b-2",
        byBuild: false,
        minAgeSeconds: 60,
        max: 5,
        exclude: ["unknown_outcome"],
    }
    const old = new Date(WHEN.getTime() - 120_000)

    it("lists the parked runs a machine may take: under the cap, past the pause and the age, with a failed step it may retry", async () => {
        const { service, records } = await build()
        records.runsOf.mockResolvedValue([
            runRecordOf({ id: "ok", endedAt: old, resumeNotBefore: old }),
            runRecordOf({ id: "capped", endedAt: old, resumeAttempts: 5 }),
            runRecordOf({ id: "paused", endedAt: old, resumeNotBefore: new Date(WHEN.getTime() + 1000) }),
            runRecordOf({ id: "young", endedAt: WHEN }),
            runRecordOf({ id: "stays", endedAt: old }),
            runRecordOf({ id: "never-ended", endedAt: null }),
            runRecordOf({ id: "later", endedAt: old }),
        ])
        records.stepsOf.mockImplementation((_scoped, runId) =>
            Promise.resolve([
                stepRecordOf({ status: "failed", errorCode: runId === "stays" ? "unknown_outcome" : null }),
            ]),
        )

        const found = await service.parked(QUERY)

        expect(found).toEqual([
            { runId: "ok", workspaceId: "ws-1" },
            { runId: "never-ended", workspaceId: "ws-1" },
        ])
    })

    it("takes only runs parked under another build when asked, and skips a run with no failed step", async () => {
        const { service, records } = await build()
        records.runsOf.mockResolvedValue([
            runRecordOf({ id: "same", parkedBuild: "b-2" }),
            runRecordOf({ id: "other", parkedBuild: "b-1" }),
            runRecordOf({ id: "bare", parkedBuild: "b-1" }),
        ])
        records.stepsOf.mockImplementation((_scoped, runId) =>
            Promise.resolve(runId === "bare" ? [stepRecordOf()] : [stepRecordOf({ status: "failed" })]),
        )

        await expect(service.parked({ ...QUERY, byBuild: true, minAgeSeconds: 0 })).resolves.toEqual([
            { runId: "other", workspaceId: "ws-1" },
        ])
    })
})

describe("AgentRunParkStoreService parked facts and standing", () => {
    it("lists the parked runs for a person: newest first (whatever order the index gave), with the step they failed on and when they parked, leaving out one with no failed step", async () => {
        const { service, records } = await build()
        records.runsOf.mockResolvedValue([
            runRecordOf({
                id: "r1",
                agentId: "a1",
                status: "parked",
                endedAt: WHEN,
                context: { subject: { kind: "x", id: "1" } },
            }),
            runRecordOf({ id: "r2", status: "parked", endedAt: null }),
            runRecordOf({ id: "r3", status: "parked", endedAt: null }),
        ])
        records.stepsOf.mockImplementation((_scoped, runId) =>
            Promise.resolve(
                runId === "r3"
                    ? [stepRecordOf({ stepKey: "ok", status: "done" })]
                    : [stepRecordOf({ stepKey: "send", status: "failed", errorCode: runId === "r1" ? "boom" : null })],
            ),
        )

        const found = await service.parkedFacts("ws-1", 500)

        expect(found.map((fact) => [fact.runId, fact.agentId, fact.stepKey, fact.errorCode])).toEqual([
            ["r1", "a1", "send", "boom"],
            ["r2", runRecordOf().agentId, "send", ""],
        ])
        expect(found[0]).toMatchObject({ parkedAt: WHEN.toISOString(), context: { subject: { kind: "x", id: "1" } } })
        expect(found[1]?.parkedAt).toBe(new Date(0).toISOString())
        expect(records.runsOf.mock.calls[0]?.[4]).toBe(100)
    })

    it("answers where a run stands, and null for a run of another workspace or none", async () => {
        const { service, store } = await build()
        store.runById.mockResolvedValueOnce(runViewOf({ workspaceId: "ws-1", agentId: "a1", status: "parked" }))
        store.runById.mockResolvedValueOnce(runViewOf({ workspaceId: "ws-1", agentId: "a1", status: "running" }))
        store.runById.mockResolvedValueOnce(runViewOf({ workspaceId: "ws-2" }))
        store.runById.mockResolvedValueOnce(null)
        await expect(service.standingOf("ws-1", "r1")).resolves.toEqual({ agentId: "a1", parked: true })
        await expect(service.standingOf("ws-1", "r1")).resolves.toEqual({ agentId: "a1", parked: false })
        await expect(service.standingOf("ws-1", "r1")).resolves.toBeNull()
        await expect(service.standingOf("ws-1", "r1")).resolves.toBeNull()
    })
})
