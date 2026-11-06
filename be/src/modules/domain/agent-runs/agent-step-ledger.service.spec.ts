import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { WHEN, runRecordOf, stepRecordOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import type { StepRecord } from "./agent-runs.records"

const scoped = mock<ScopedTx>({ workspaceId: "ws-1" })
const REF = { runId: "run-1", workspaceId: "ws-1" }
const at = (ms: number): string => new Date(WHEN.getTime() + ms).toISOString()

const build = async () => {
    const em: MockEntityManager = mockEntityManager()
    fakeTransaction(em)
    const store = mock<AgentRunStoreService>()
    store.at.mockImplementation((_ws, _manager, work) => work(scoped))
    store.patchRunWith.mockImplementation(async (_scoped, _runId, builder) => {
        await builder(runRecordOf())
        return runRecordOf()
    })
    const records = mock<AgentRunRecordsService>()
    records.run.mockResolvedValue(runRecordOf())
    const queue = mock<AgentStepQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentStepLedgerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(WHEN) },
            { provide: AgentStepQueue, useValue: queue },
            { provide: AgentRunStoreService, useValue: store },
            { provide: AgentRunRecordsService, useValue: records },
        ],
    }).compile()
    return { ledger: moduleRef.get(AgentStepLedgerService), em, store, records, queue }
}

type Records = ReturnType<typeof mock<AgentRunRecordsService>>

const withSteps = (records: Records, steps: ReadonlyArray<StepRecord>): void => {
    records.stepsOf.mockResolvedValue(steps)
    records.patchStep.mockImplementation((_scoped, step) =>
        Promise.resolve({ ...step, version: String(Number(step.version) + 1) }),
    )
}

describe("AgentStepLedgerService claim", () => {
    it("answers gone for a run that is not there and closed for a run that took no step", async () => {
        const { ledger, records } = await build()
        records.run.mockResolvedValueOnce(null).mockResolvedValueOnce(runRecordOf({ status: "parked" }))

        await expect(ledger.claim(REF, null)).resolves.toEqual({ kind: "gone" })
        await expect(ledger.claim(REF, null)).resolves.toEqual({ kind: "closed" })
    })

    it("answers idle when no step is open and gone for a step key the run does not hold", async () => {
        const { ledger, records } = await build()
        withSteps(records, [stepRecordOf({ status: "done" })])

        await expect(ledger.claim(REF, null)).resolves.toEqual({ kind: "idle" })
        await expect(ledger.claim(REF, "nope")).resolves.toEqual({ kind: "gone" })
    })

    it("answers the stored result of a done step and closed for a step that failed or is being undone", async () => {
        const { ledger, records } = await build()
        withSteps(records, [stepRecordOf({ stepKey: "a", status: "done", result: { x: 1 } })])
        await expect(ledger.claim(REF, "a")).resolves.toEqual({ kind: "done", answer: { x: 1 } })

        withSteps(records, [stepRecordOf({ stepKey: "a", status: "failed" })])
        await expect(ledger.claim(REF, "a")).resolves.toEqual({ kind: "closed" })
        withSteps(records, [stepRecordOf({ stepKey: "a", status: "compensating" })])
        await expect(ledger.claim(REF, "a")).resolves.toEqual({ kind: "closed" })
    })

    it("answers busy while a claim lives, waiting_expired for a wait whose claim ran out", async () => {
        const { ledger, records } = await build()
        withSteps(records, [
            stepRecordOf({ stepKey: "a", status: "running", claimedUntil: new Date(WHEN.getTime() + 5000) }),
        ])
        await expect(ledger.claim(REF, "a")).resolves.toEqual({ kind: "busy" })

        withSteps(records, [
            stepRecordOf({
                stepKey: "a",
                status: "running",
                claimedUntil: new Date(WHEN.getTime() - 1),
                waitItemId: "item-1",
            }),
        ])
        await expect(ledger.claim(REF, "a")).resolves.toMatchObject({ kind: "waiting_expired", step: { stepKey: "a" } })
    })
})

describe("AgentStepLedgerService claim of a step", () => {
    it("answers later with the whole seconds left of a backoff and exhausted when the tries are spent", async () => {
        const { ledger, records } = await build()
        withSteps(records, [
            stepRecordOf({ stepKey: "a", status: "pending", notBefore: new Date(WHEN.getTime() + 1500) }),
        ])
        await expect(ledger.claim(REF, "a")).resolves.toEqual({ kind: "later", retryAfterMs: 2000 })

        withSteps(records, [stepRecordOf({ stepKey: "a", status: "pending", attempt: 3, notBefore: null })])
        await expect(ledger.claim(REF, "a")).resolves.toMatchObject({ kind: "exhausted" })
    })

    it("takes a running step whose claim ran out with no deadline recorded", async () => {
        const { ledger, records } = await build()
        withSteps(records, [stepRecordOf({ status: "running", claimedUntil: null })])

        await expect(ledger.claim(REF, null)).resolves.toMatchObject({ kind: "claimed" })
    })

    it("takes the first open step under a new fence and wakes a waiting run", async () => {
        const { ledger, records } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "waiting" }))
        withSteps(records, [
            stepRecordOf({ stepKey: "done", ordinal: 1, status: "done", result: { r: 1 } }),
            stepRecordOf({ stepKey: "next", ordinal: 2, id: "s-2", status: "pending", attempt: 0, notBefore: null }),
        ])

        records.patchStep.mockResolvedValue(
            stepRecordOf({ stepKey: "next", ordinal: 2, id: "s-2", status: "running", attempt: 1, version: "3" }),
        )

        const claim = await ledger.claim(REF, null)

        expect(claim).toMatchObject({
            kind: "claimed",
            step: { stepKey: "next", status: "running", attempt: 1, fence: 3, earlier: { done: { r: 1 } } },
        })
        expect(records.patchStep).toHaveBeenCalledWith(scoped, expect.objectContaining({ stepKey: "next" }), {
            status: "running",
            attempt: 1,
            claimedUntil: at(1000),
            startedAt: WHEN.toISOString(),
        })
        expect(records.patchRun).toHaveBeenCalledWith(scoped, expect.anything(), { status: "running" })
    })

    it("answers busy when a racing claimer took the step first", async () => {
        const { ledger, records } = await build()
        withSteps(records, [stepRecordOf({ status: "pending", notBefore: null, attempt: 0 })])
        records.patchStep.mockResolvedValue(null)

        await expect(ledger.claim(REF, "step-1")).resolves.toEqual({ kind: "busy" })
    })

    it("claims inside a caller's transaction", async () => {
        const { ledger, store, em, records } = await build()
        withSteps(records, [stepRecordOf({ status: "pending", notBefore: null, attempt: 0 })])

        await ledger.claimIn(em, REF, "step-1")

        expect(store.at).toHaveBeenCalledWith("ws-1", em, expect.any(Function))
    })
})

const claimed = stepViewOf({ stepKey: "step-1", fence: 2, attempt: 1 })
const running = stepRecordOf({ stepKey: "step-1", status: "running", version: "2" })

describe("AgentStepLedgerService commit", () => {
    it("is fenced when the run or the step is gone, the fence moved on or the step is not running", async () => {
        const { ledger, records } = await build()
        const done = { kind: "done" as const, result: {}, next: [] }
        records.run.mockResolvedValueOnce(null)
        withSteps(records, [running])
        await expect(ledger.commit(claimed, done)).resolves.toBe("fenced")

        withSteps(records, [])
        await expect(ledger.commit(claimed, done)).resolves.toBe("fenced")
        withSteps(records, [stepRecordOf({ stepKey: "step-1", status: "running", version: "9" })])
        await expect(ledger.commit(claimed, done)).resolves.toBe("fenced")
        withSteps(records, [stepRecordOf({ stepKey: "step-1", status: "pending", version: "2" })])
        await expect(ledger.commit(claimed, done)).resolves.toBe("fenced")
        withSteps(records, [running])
        records.patchStep.mockResolvedValue(null)
        await expect(ledger.commit(claimed, done)).resolves.toBe("fenced")
    })

    it("stores a result, clears the claim and writes the steps that follow with the job that drives them", async () => {
        const { ledger, records, store, queue } = await build()
        withSteps(records, [running])

        const result = await ledger.commit(claimed, { kind: "done", result: { ok: 1 }, next: [] })

        expect(result).toBe("ok")
        expect(records.patchStep).toHaveBeenCalledWith(
            scoped,
            running,
            expect.objectContaining({ status: "done", result: { ok: 1 }, claimedUntil: null, waitItemId: null }),
        )
        expect(store.appendRows).toHaveBeenCalled()
        expect(queue.enqueueAdvance).toHaveBeenCalledWith(
            { runId: "run-1", workspaceId: "ws-1" },
            "step-1",
            "done",
            expect.anything(),
        )
    })

    it("stores an empty result for one JSON cannot carry", async () => {
        const { ledger, records } = await build()
        withSteps(records, [running])

        await ledger.commit(claimed, { kind: "done", result: { bad: () => 1 }, next: [] })

        expect(records.patchStep).toHaveBeenCalledWith(scoped, running, expect.objectContaining({ result: {} }))
    })
})

describe("AgentStepLedgerService commit waits and retries", () => {
    it("holds a wait on the work item until its deadline and writes no job", async () => {
        const { ledger, records, queue } = await build()
        withSteps(records, [running])

        await ledger.commit(claimed, { kind: "wait", workItemId: "item-1", deadlineAt: new Date(at(60_000)) })

        expect(records.patchStep).toHaveBeenCalledWith(scoped, running, {
            waitItemId: "item-1",
            workItemId: "item-1",
            claimedUntil: at(60_000),
        })
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })

    it("puts a retried step back to pending after the backoff and writes the job that tries it again", async () => {
        const { ledger, records, queue } = await build()
        withSteps(records, [running])

        await ledger.commit(claimed, { kind: "retry", code: "boom", afterMs: 1500 })

        expect(records.patchStep).toHaveBeenCalledWith(scoped, running, {
            status: "pending",
            errorCode: "boom",
            claimedUntil: null,
            waitItemId: null,
            notBefore: at(2000),
        })
        expect(queue.enqueueAdvance).toHaveBeenCalledWith(expect.anything(), "step-1", "retry-1", expect.anything())
    })

    it("marks a step failed with its code and writes no job", async () => {
        const { ledger, records, queue } = await build()
        withSteps(records, [running])

        await ledger.commit(claimed, { kind: "failed", code: "boom" })

        expect(records.patchStep).toHaveBeenCalledWith(scoped, running, {
            status: "failed",
            errorCode: "boom",
            claimedUntil: null,
            waitItemId: null,
        })
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })
})

describe("AgentStepLedgerService commit settles the run", () => {
    it("settles the run from its steps: running while a step follows or can run, done at the end, waiting on a wait, a bump when closed", async () => {
        const { ledger, records, store } = await build()
        withSteps(records, [running])
        const written: Array<unknown> = []
        store.patchRunWith.mockImplementation(async (_scoped, _runId, builder) => {
            written.push(await builder(runRecordOf({ status: "running", stepSeq: 6 })))
            written.push(await builder(runRecordOf({ status: "parked", stepSeq: 6 })))
            return runRecordOf()
        })

        const done = { kind: "done" as const, result: {}, next: [] }
        const after = (steps: ReadonlyArray<StepRecord>): void => {
            records.stepsOf.mockReset().mockResolvedValueOnce([running]).mockResolvedValue(steps)
        }
        after([stepRecordOf({ status: "done" })])
        await ledger.commit(claimed, done)
        after([stepRecordOf({ status: "done" }), stepRecordOf({ status: "pending" })])
        await ledger.commit(claimed, { ...done, continues: true })
        after([])
        await ledger.commit(claimed, { kind: "retry", code: "x", afterMs: 0 })
        after([stepRecordOf({ status: "done" }), stepRecordOf({ status: "pending" })])
        await ledger.commit(claimed, { kind: "wait", workItemId: "item-1", deadlineAt: WHEN })
        after([stepRecordOf({ status: "done" }), stepRecordOf({ status: "running", waitItemId: "item-1" })])
        await ledger.commit(claimed, { kind: "wait", workItemId: "item-1", deadlineAt: WHEN })

        expect(written.filter((_value, index) => index % 2 === 0)).toEqual([
            { status: "done", endedAt: WHEN.toISOString() },
            { status: "running" },
            { status: "running" },
            { status: "running" },
            { status: "waiting" },
        ])
        expect(written.filter((_value, index) => index % 2 === 1)).toEqual(
            Array.from({ length: 5 }, () => ({ stepSeq: 6 })),
        )
    })
})

describe("AgentStepLedgerService release", () => {
    it("gives the claim back one second in the past", async () => {
        const { ledger, records } = await build()
        withSteps(records, [stepRecordOf({ stepKey: "step-1", status: "running", version: "2" })])

        await expect(ledger.release(claimed)).resolves.toBe(true)
        expect(records.patchStep).toHaveBeenCalledWith(scoped, expect.anything(), { claimedUntil: at(-1000) })
    })

    it("leaves a claim that moved on, a wait, a step that is gone and a step that moved first", async () => {
        const { ledger, records } = await build()
        withSteps(records, [stepRecordOf({ stepKey: "step-1", status: "running", version: "9" })])
        await expect(ledger.release(claimed)).resolves.toBe(false)
        withSteps(records, [stepRecordOf({ stepKey: "step-1", status: "running", version: "2", waitItemId: "item-1" })])
        await expect(ledger.release(claimed)).resolves.toBe(false)
        withSteps(records, [stepRecordOf({ stepKey: "step-1", status: "pending", version: "2" })])
        await expect(ledger.release(claimed)).resolves.toBe(false)
        withSteps(records, [])
        await expect(ledger.release(claimed)).resolves.toBe(false)
        withSteps(records, [stepRecordOf({ stepKey: "step-1", status: "running", version: "2" })])
        records.patchStep.mockResolvedValue(null)
        await expect(ledger.release(claimed)).resolves.toBe(false)
    })
})

describe("AgentStepLedgerService compensation", () => {
    it("is closed for a run that is not compensating", async () => {
        const { ledger, records } = await build()
        records.run.mockResolvedValueOnce(null).mockResolvedValueOnce(runRecordOf())

        await expect(ledger.claimCompensation(REF)).resolves.toEqual({ kind: "closed" })
        await expect(ledger.claimCompensation(REF)).resolves.toEqual({ kind: "closed" })
    })

    it("ends the run as compensated when no step is left to undo", async () => {
        const { ledger, records, store } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "compensating" }))
        withSteps(records, [stepRecordOf({ status: "compensated" })])
        const wrote: Array<unknown> = []
        store.patchRunWith.mockImplementation(async (_scoped, _runId, builder) => {
            wrote.push(await builder(runRecordOf({ status: "compensating" })), await builder(runRecordOf()))
            return null
        })

        await expect(ledger.claimCompensation(REF)).resolves.toEqual({ kind: "finished" })
        expect(wrote).toEqual([{ status: "compensated", endedAt: WHEN.toISOString() }, null])
    })

    it("claims the last step to undo under a lease, and is busy while a lease lives or a racer won", async () => {
        const { ledger, records } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "compensating" }))
        withSteps(records, [
            stepRecordOf({ stepKey: "a", ordinal: 1, status: "compensating" }),
            stepRecordOf({ stepKey: "b", ordinal: 2, id: "s-2", status: "compensating" }),
        ])

        await expect(ledger.claimCompensation(REF)).resolves.toMatchObject({
            kind: "claimed",
            step: { stepKey: "b", fence: 3 },
        })
        expect(records.patchStep).toHaveBeenCalledWith(scoped, expect.objectContaining({ stepKey: "b" }), {
            claimedUntil: at(120_000),
        })

        withSteps(records, [stepRecordOf({ status: "compensating", claimedUntil: new Date(WHEN.getTime() + 1000) })])
        await expect(ledger.claimCompensation(REF)).resolves.toEqual({ kind: "busy" })
        withSteps(records, [stepRecordOf({ status: "compensating" })])
        records.patchStep.mockResolvedValue(null)
        await expect(ledger.claimCompensation(REF)).resolves.toEqual({ kind: "busy" })
    })
})

describe("AgentStepLedgerService compensation marks", () => {
    it("is fenced when the step is gone, moved on or not compensating", async () => {
        const { ledger, records } = await build()
        const step = stepViewOf({ stepKey: "step-1", fence: 2 })
        withSteps(records, [])
        await expect(ledger.commitCompensation(step, true, null)).resolves.toBe("fenced")
        withSteps(records, [stepRecordOf({ status: "compensating", version: "9" })])
        await expect(ledger.commitCompensation(step, true, null)).resolves.toBe("fenced")
        withSteps(records, [stepRecordOf({ status: "done", version: "2" })])
        await expect(ledger.commitCompensation(step, true, null)).resolves.toBe("fenced")
    })

    it("marks an undone step compensated, or fenced when a racer wrote first", async () => {
        const { ledger, records } = await build()
        const step = stepViewOf({ stepKey: "step-1", fence: 2 })
        withSteps(records, [stepRecordOf({ status: "compensating", version: "2" })])

        await expect(ledger.commitCompensation(step, true, null)).resolves.toBe("ok")
        expect(records.patchStep).toHaveBeenCalledWith(scoped, expect.anything(), {
            status: "compensated",
            claimedUntil: null,
            errorCode: null,
        })
        records.patchStep.mockResolvedValue(null)
        await expect(ledger.commitCompensation(step, true, null)).resolves.toBe("fenced")
        await expect(ledger.commitCompensation(step, false, "boom")).resolves.toBe("fenced")
    })

    it("keeps a failed undo for another try and gives the run to a person past the tries", async () => {
        const { ledger, records, store } = await build()
        const step = stepViewOf({ stepKey: "step-1", fence: 2 })
        withSteps(records, [stepRecordOf({ status: "compensating", version: "2", compAttempts: 0 })])

        await expect(ledger.commitCompensation(step, false, "boom")).resolves.toBe("ok")
        expect(records.patchStep).toHaveBeenCalledWith(scoped, expect.anything(), {
            compAttempts: 1,
            errorCode: "boom",
            claimedUntil: at(30_000),
        })

        withSteps(records, [stepRecordOf({ status: "compensating", version: "2", compAttempts: 2 })])
        const wrote: Array<unknown> = []
        store.patchRunWith.mockImplementation(async (_scoped, _runId, builder) => {
            wrote.push(await builder(runRecordOf()))
            return runRecordOf()
        })
        await expect(ledger.commitCompensation(step, false, "boom")).resolves.toBe("dead")
        expect(wrote).toEqual([{ status: "dead", error: { code: "compensation_failed" }, endedAt: WHEN.toISOString() }])
    })
})
