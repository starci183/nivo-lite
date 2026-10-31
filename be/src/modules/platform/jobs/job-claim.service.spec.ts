import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { QueryBuilderAnswers } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob, FailedJobEffect, JobEffect } from "./jobs.contracts"
import { JOBS_MANAGERS } from "./jobs.decorators"
import { JobClaimService } from "./job-claim.service"
import { JobEntity } from "./persistence/entities"

const AT = "2026-02-03T04:05:06.000Z"

const build = async (manager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobClaimService,
            { provide: JOBS_MANAGERS, useValue: [manager] },
            { provide: CLOCK, useValue: new FakeClock(AT) },
        ],
    }).compile()
    return { claims: moduleRef.get(JobClaimService) }
}

const buildWithoutConnection = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobClaimService,
            { provide: JOBS_MANAGERS, useValue: [] },
            { provide: CLOCK, useValue: new FakeClock(AT) },
        ],
    }).compile()
    return { claims: moduleRef.get(JobClaimService) }
}

const stateOf = (status: "running" | "done" | "failed", leaseExpiresAt: Date | null): JobEntity =>
    Object.assign(new JobEntity(), { status, leaseExpiresAt })

/** A manager whose next query builder answers as given. */
const managerWith = (answers: QueryBuilderAnswers) => {
    const manager = mockEntityManager()
    const [builder] = queueQueryBuilders(manager, [answers])
    return { manager, builder }
}

const lockOf = (found: boolean, extra: Partial<JobEntity> = {}) =>
    managerWith({ getOne: found ? Object.assign(new JobEntity(), { id: "j-1", ...extra }) : null })

const FAILED_ROW = { id: "j-failed", fencingToken: 7 }
const CLAIM_PARAMS = { kind: "mail", jobKey: "k-1", payload: { id: "m-1" }, workerId: "w-1", leaseMs: 60000 }
const CLAIM_ROW = { id: "j-1", kind: "mail", fencing_token: "3", current_step: null, payload: { id: "m-1" } }

const claimed: ClaimedJob = { jobId: "j-1", kind: "mail", fencingToken: 3, currentStep: null, payload: { id: "m-1" } }

describe("JobClaimService", () => {
    describe("retryAfterSeconds", () => {
        it("permits idempotent completion only for a confirmed done claim", async () => {
            const manager = mockEntityManager({ findOne: [JobEntity, stateOf("done", null)] })
            const { claims } = await build(manager)

            await expect(claims.retryAfterSeconds("k-1")).resolves.toBeNull()

            expect(manager.findOne).toHaveBeenCalledWith(JobEntity, {
                select: { status: true, leaseExpiresAt: true },
                where: { jobKey: "k-1" },
            })
        })

        it("rounds a live foreign lease up so the broker cannot complete its unfinished work", async () => {
            const manager = mockEntityManager({
                findOne: [JobEntity, stateOf("running", new Date("2026-02-03T04:06:06.001Z"))],
            })
            const { claims } = await build(manager)

            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(61)
        })

        it("bounds a long live lease and retries a lapsed lease on the next second", async () => {
            const manager = mockEntityManager({
                findOne: [JobEntity, stateOf("running", new Date("2026-02-03T06:05:06.000Z"))],
            })
            const { claims } = await build(manager)

            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(3600)
            manager.findOne.mockResolvedValue(stateOf("running", new Date("2026-02-03T04:05:05.000Z")))
            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(1)
        })

        it("conservatively defers missing rows and failed claims that raced the refused upsert", async () => {
            const manager = mockEntityManager({ findOne: [JobEntity, null] })
            const { claims } = await build(manager)

            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(1)
            manager.findOne.mockResolvedValue(stateOf("failed", null))
            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(1)
        })
    })
})

describe("JobClaimService", () => {
    describe("claim", () => {
        it("claims a new delivery in one insert and returns the job with its first token", async () => {
            const manager = mockEntityManager()
            const [insert] = queueQueryBuilders(manager, [{ execute: { raw: [{ ...CLAIM_ROW, fencing_token: "1" }] } }])
            const { claims } = await build(manager)

            const job = await claims.claim(CLAIM_PARAMS)

            expect(job).toEqual({ ...claimed, fencingToken: 1 })
            expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1)
            expect(manager.createQueryBuilder).toHaveBeenCalledWith(JobEntity, "jobs")
            expect(insert?.callsOf("insert")).toEqual([[]])
            expect(insert?.callsOf("values")).toEqual([
                [
                    {
                        kind: "mail",
                        jobKey: "k-1",
                        status: "running",
                        fencingToken: 1,
                        claimedBy: "w-1",
                        leaseExpiresAt: new Date("2026-02-03T04:06:06.000Z"),
                        payload: { id: "m-1" },
                    },
                ],
            ])
            expect(insert?.callsOf("orIgnore")).toHaveLength(1)
            expect(insert?.callsOf("returning")).toEqual([["id, kind, fencing_token, current_step, payload"]])
        })

        it("re-claims a failed or lapsed job in one update that bumps the token in the store", async () => {
            const manager = mockEntityManager()
            const [, update] = queueQueryBuilders(manager, [
                { execute: { raw: [] } },
                { execute: { raw: [CLAIM_ROW] } },
            ])
            const { claims } = await build(manager)

            await expect(claims.claim(CLAIM_PARAMS)).resolves.toEqual(claimed)

            expect(update?.callsOf("update")).toEqual([[]])
            const set = update?.callsOf("set")[0]?.[0]
            expect(set).toMatchObject({
                claimedBy: "w-1",
                leaseExpiresAt: new Date("2026-02-03T04:06:06.000Z"),
                status: "running",
                error: null,
            })
            const bump: unknown = Reflect.get(set ?? {}, "fencingToken")
            expect(typeof bump === "function" ? Reflect.apply(bump, undefined, []) : bump).toBe("fencing_token + 1")
            expect(update?.callsOf("where")).toEqual([
                [
                    "jobs.jobKey = :jobKey AND (jobs.status = :failed OR (jobs.status = :running AND jobs.leaseExpiresAt < :now))",
                    { jobKey: "k-1", failed: "failed", running: "running", now: new Date(AT) },
                ],
            ])
            expect(update?.callsOf("returning")).toEqual([["id, kind, fencing_token, current_step, payload"]])
        })

        it("answers null when the job is done or another worker holds a live claim", async () => {
            const manager = mockEntityManager()
            queueQueryBuilders(manager, [{ execute: { raw: [] } }, { execute: { raw: [] } }])
            const { claims } = await build(manager)

            await expect(claims.claim(CLAIM_PARAMS)).resolves.toBeNull()
        })

        it("refuses a returned row whose payload is not an object", async () => {
            const manager = mockEntityManager()
            queueQueryBuilders(manager, [{ execute: { raw: [{ ...CLAIM_ROW, payload: "text" }] } }])
            const { claims } = await build(manager)

            await expect(claims.claim(CLAIM_PARAMS)).rejects.toThrow("DATABASE_RETURNING_ROW_REJECTED")
        })
    })
})

describe("JobClaimService", () => {
    describe("guarded writes", () => {
        it("records a step, completes and fails under the token the caller holds", async () => {
            const manager = mockEntityManager({ update: [JobEntity, { affected: 1 }] })
            const { claims } = await build(manager)
            const held = { id: "j-1", fencingToken: 3, status: "running" }

            await claims.advance({ jobId: "j-1", expectedFencingToken: 3, step: "send" })
            await claims.complete({ jobId: "j-1", expectedFencingToken: 3 })
            await claims.fail({ jobId: "j-1", expectedFencingToken: 3, reason: "boom" })

            expect(manager.update).toHaveBeenNthCalledWith(1, JobEntity, held, {
                currentStep: "send",
            })
            expect(manager.update).toHaveBeenNthCalledWith(2, JobEntity, held, {
                status: "done",
                leaseExpiresAt: null,
            })
            expect(manager.update).toHaveBeenNthCalledWith(3, JobEntity, held, {
                status: "failed",
                error: "boom",
                leaseExpiresAt: null,
            })
        })

        it("throws JobFencedOut when a write finds no row at its token: a newer worker owns the job", async () => {
            const manager = mockEntityManager({ update: [JobEntity, { affected: 0 }] })
            const { claims } = await build(manager)

            const attempts = [
                claims.advance({ jobId: "j-1", expectedFencingToken: 2, step: "send" }),
                claims.complete({ jobId: "j-1", expectedFencingToken: 2 }),
                claims.fail({ jobId: "j-1", expectedFencingToken: 2, reason: "boom" }),
            ]

            for (const attempt of attempts) {
                await expect(attempt).rejects.toMatchObject({
                    code: JobsErrorCode.FencedOut,
                    params: { jobId: "j-1", token: 2 },
                })
                await expect(attempt).rejects.toBeInstanceOf(JobsError)
            }
        })
    })

    describe("runKey", () => {
        it("includes the job, step and fencing token to distinguish a zombie worker's key", async () => {
            const { claims } = await build(mockEntityManager())

            expect(claims.runKey(claimed, "send")).toBe("j-1:send:3")
            expect(claims.runKey({ ...claimed, fencingToken: 4 }, "send")).toBe("j-1:send:4")
        })

        it("refuses a step name that carries the separator, because the key would be ambiguous", async () => {
            const { claims } = await build(mockEntityManager())

            expect(() => claims.runKey(claimed, "send:twice")).toThrow(JobsError)
            expect(() => claims.runKey(claimed, "send:twice")).toThrow(JobsErrorCode.RunKeyInvalid)
        })
    })
})

describe("JobClaimService", () => {
    describe("withFence", () => {
        it("returns the domain effect result while holding the live token in a committed transaction", async () => {
            const { manager, builder: lock } = lockOf(true)
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: JobEffect<string> }>()
            effect.run.mockResolvedValue("sent")

            await expect(claims.withFence(claimed, effect.run)).resolves.toBe("sent")

            expect(lock?.callsOf("where")).toEqual([
                [
                    "job.id = :jobId AND job.fencingToken = :token AND job.status = :running",
                    { jobId: "j-1", token: 3, running: "running" },
                ],
            ])
            expect(lock?.callsOf("setLock")).toEqual([["pessimistic_write"]])
            expect(effect.run).toHaveBeenCalledTimes(1)
            expect(effect.run).toHaveBeenCalledWith()
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("rejects a stale token before calling the effect and rolls the transaction back", async () => {
            const { manager } = lockOf(false)
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: JobEffect<string> }>()

            await expect(claims.withFence(claimed, effect.run)).rejects.toMatchObject({
                name: "JobsError",
                code: JobsErrorCode.FencedOut,
                params: { jobId: "j-1", token: 3 },
            })

            expect(effect.run).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["rollback"])
        })

        it("propagates a failed effect and rolls the live fence transaction back", async () => {
            const { manager } = lockOf(true)
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: JobEffect<string> }>()
            const failure = new TypeError("delivery failed")
            effect.run.mockRejectedValue(failure)

            await expect(claims.withFence(claimed, effect.run)).rejects.toBe(failure)

            expect(effect.run).toHaveBeenCalledTimes(1)
            expect(transaction.outcomes).toEqual(["rollback"])
        })
    })
})

describe("JobClaimService", () => {
    describe("withFailedFence", () => {
        it("passes the failed claim and its numeric token to the terminal effect", async () => {
            const { manager, builder: lock } = lockOf(true, FAILED_ROW)
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: FailedJobEffect }>()
            effect.run.mockResolvedValue(undefined)

            await expect(claims.withFailedFence("failed-delivery", effect.run)).resolves.toBeUndefined()

            expect(lock?.callsOf("where")).toEqual([
                ["job.jobKey = :jobKey AND job.status = :failed", { jobKey: "failed-delivery", failed: "failed" }],
            ])
            expect(lock?.callsOf("setLock")).toEqual([["pessimistic_write"]])
            expect(effect.run).toHaveBeenCalledTimes(1)
            expect(effect.run).toHaveBeenCalledWith({ jobId: "j-failed", expectedFencingToken: 7 })
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("commits without a terminal effect when no failed claim remains", async () => {
            const { manager } = lockOf(false)
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: FailedJobEffect }>()

            await expect(claims.withFailedFence("failed-delivery", effect.run)).resolves.toBeUndefined()

            expect(effect.run).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("propagates a terminal effect failure and rolls the failed fence back", async () => {
            const { manager } = lockOf(true, FAILED_ROW)
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: FailedJobEffect }>()
            const failure = new TypeError("terminal delivery failed")
            effect.run.mockRejectedValue(failure)

            await expect(claims.withFailedFence("failed-delivery", effect.run)).rejects.toBe(failure)

            expect(effect.run).toHaveBeenCalledWith({ jobId: "j-failed", expectedFencingToken: 7 })
            expect(transaction.outcomes).toEqual(["rollback"])
        })
    })

    describe("registration", () => {
        it("refuses to claim with no connection to hold the job table", async () => {
            const { claims } = await buildWithoutConnection()

            await expect(claims.claim(CLAIM_PARAMS)).rejects.toMatchObject({
                code: JobsErrorCode.ConnectionMissing,
            })
        })
    })
})
