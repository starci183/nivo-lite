import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob, FailedJobEffect, JobEffect } from "./jobs.contracts"
import { JOBS_MANAGERS } from "./jobs.decorators"
import { JobClaimService } from "./job-claim.service"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
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

/** A manager whose query builder is the given double. */
const managerWith = (
    builder: ReturnType<typeof fakeQueryBuilder>,
    stubs: Parameters<typeof mockEntityManager>[0] = {},
) => {
    const manager = mockEntityManager(stubs)
    manager.createQueryBuilder.mockReturnValue(builder.builder as never)
    return manager
}

const lockOf = (found: boolean, extra: Partial<JobEntity> = {}) =>
    fakeQueryBuilder({ getOne: found ? Object.assign(new JobEntity(), { id: "j-1", ...extra }) : null })

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
        it("claims the delivery in one statement and returns the job with the bumped token", async () => {
            const upsert = fakeQueryBuilder({
                execute: {
                    raw: [{ id: "j-1", kind: "mail", fencing_token: "3", current_step: null, payload: { id: "m-1" } }],
                },
            })
            const manager = managerWith(upsert)
            const { claims } = await build(manager)

            const job = await claims.claim({
                kind: "mail",
                jobKey: "k-1",
                payload: { id: "m-1" },
                workerId: "w-1",
                leaseMs: 60000,
            })

            expect(job).toEqual(claimed)
            expect(manager.createQueryBuilder).toHaveBeenCalledWith(JobEntity, "jobs")
            expect(upsert.callsOf("insert")).toEqual([[]])
            expect(upsert.callsOf("values")).toEqual([
                [
                    {
                        kind: "mail",
                        jobKey: "k-1",
                        status: "running",
                        fencingToken: 1,
                        claimedBy: "w-1",
                        leaseExpiresAt: new Date("2026-02-03T04:06:06.000Z"),
                        payload: { id: "m-1" },
                        createdAt: new Date(AT),
                        updatedAt: new Date(AT),
                    },
                ],
            ])
            expect(upsert.callsOf("onConflict")).toHaveLength(1)
            expect(String(upsert.callsOf("onConflict")[0]?.[0])).toContain("fencing_token = jobs.fencing_token + 1")
            expect(upsert.callsOf("setParameter")).toEqual([
                ["claimedBy", "w-1"],
                ["leaseExpiresAt", new Date("2026-02-03T04:06:06.000Z")],
                ["now", new Date(AT)],
            ])
            expect(upsert.callsOf("returning")).toEqual([["id, kind, fencing_token, current_step, payload"]])
        })

        it("answers null when the job is done or another worker holds a live claim", async () => {
            const manager = managerWith(fakeQueryBuilder({ execute: { raw: [] } }))
            const { claims } = await build(manager)

            await expect(
                claims.claim({ kind: "mail", jobKey: "k-1", payload: {}, workerId: "w-1", leaseMs: 1000 }),
            ).resolves.toBeNull()
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
                updatedAt: new Date(AT),
            })
            expect(manager.update).toHaveBeenNthCalledWith(2, JobEntity, held, {
                status: "done",
                leaseExpiresAt: null,
                updatedAt: new Date(AT),
            })
            expect(manager.update).toHaveBeenNthCalledWith(3, JobEntity, held, {
                status: "failed",
                error: "boom",
                leaseExpiresAt: null,
                updatedAt: new Date(AT),
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
            const lock = lockOf(true)
            const manager = managerWith(lock)
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: JobEffect<string> }>()
            effect.run.mockResolvedValue("sent")

            await expect(claims.withFence(claimed, effect.run)).resolves.toBe("sent")

            expect(lock.callsOf("where")).toEqual([
                [
                    "job.id = :jobId AND job.fencingToken = :token AND job.status = :running",
                    { jobId: "j-1", token: 3, running: "running" },
                ],
            ])
            expect(lock.callsOf("setLock")).toEqual([["pessimistic_write"]])
            expect(effect.run).toHaveBeenCalledTimes(1)
            expect(effect.run).toHaveBeenCalledWith()
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("rejects a stale token before calling the effect and rolls the transaction back", async () => {
            const manager = managerWith(lockOf(false))
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
            const manager = managerWith(lockOf(true))
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
            const lock = lockOf(true, { id: "j-failed", fencingToken: 7 })
            const manager = managerWith(lock)
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: FailedJobEffect }>()
            effect.run.mockResolvedValue(undefined)

            await expect(claims.withFailedFence("failed-delivery", effect.run)).resolves.toBeUndefined()

            expect(lock.callsOf("where")).toEqual([
                ["job.jobKey = :jobKey AND job.status = :failed", { jobKey: "failed-delivery", failed: "failed" }],
            ])
            expect(lock.callsOf("setLock")).toEqual([["pessimistic_write"]])
            expect(effect.run).toHaveBeenCalledTimes(1)
            expect(effect.run).toHaveBeenCalledWith({ jobId: "j-failed", expectedFencingToken: 7 })
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("commits without a terminal effect when no failed claim remains", async () => {
            const manager = managerWith(lockOf(false))
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: FailedJobEffect }>()

            await expect(claims.withFailedFence("failed-delivery", effect.run)).resolves.toBeUndefined()

            expect(effect.run).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("propagates a terminal effect failure and rolls the failed fence back", async () => {
            const lock = lockOf(true, { id: "j-failed", fencingToken: 7 })
            const manager = managerWith(lock)
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

            await expect(
                claims.claim({ kind: "mail", jobKey: "k-1", payload: {}, workerId: "w-1", leaseMs: 1000 }),
            ).rejects.toMatchObject({
                code: JobsErrorCode.ConnectionMissing,
            })
        })
    })
})
