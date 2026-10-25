import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob, FailedJobEffect, JobEffect } from "./jobs.contracts"
import { JOBS_MANAGERS } from "./jobs.decorators"
import { JobClaimService } from "./job-claim.service"
import {
    ADVANCE_JOB,
    CLAIM_JOB,
    COMPLETE_JOB,
    FAIL_JOB,
    LOCK_FAILED_JOB_FENCE,
    LOCK_JOB_FENCE,
    JOB_CLAIM_STATE,
} from "./persistence/jobs.sql"

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

const claimed: ClaimedJob = { jobId: "j-1", kind: "mail", fencingToken: 3, currentStep: null, payload: { id: "m-1" } }

describe("JobClaimService", () => {
    describe("retryAfterSeconds", () => {
        it("permits idempotent completion only for a confirmed done claim", async () => {
            const manager = mockEntityManager({
                query: [JOB_CLAIM_STATE, [{ status: "done", lease_expires_at: null }]],
            })
            const { claims } = await build(manager)

            await expect(claims.retryAfterSeconds("k-1")).resolves.toBeNull()

            expect(manager.query).toHaveBeenCalledWith(JOB_CLAIM_STATE, ["k-1"])
        })

        it("rounds a live foreign lease up so the broker cannot complete its unfinished work", async () => {
            const manager = mockEntityManager({
                query: [
                    JOB_CLAIM_STATE,
                    [{ status: "running", lease_expires_at: new Date("2026-02-03T04:06:06.001Z") }],
                ],
            })
            const { claims } = await build(manager)

            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(61)
        })

        it("bounds a long live lease and retries a lapsed lease on the next second", async () => {
            const manager = mockEntityManager({
                query: [
                    JOB_CLAIM_STATE,
                    [{ status: "running", lease_expires_at: new Date("2026-02-03T06:05:06.000Z") }],
                ],
            })
            const { claims } = await build(manager)

            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(3600)
            manager.query.mockResolvedValue([
                { status: "running", lease_expires_at: new Date("2026-02-03T04:05:05.000Z") },
            ])
            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(1)
        })

        it("conservatively defers missing rows and failed claims that raced the refused upsert", async () => {
            const manager = mockEntityManager({ query: [JOB_CLAIM_STATE, []] })
            const { claims } = await build(manager)

            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(1)
            manager.query.mockResolvedValue([{ status: "failed", lease_expires_at: null }])
            await expect(claims.retryAfterSeconds("k-1")).resolves.toBe(1)
        })
    })
})

describe("JobClaimService", () => {
    describe("claim", () => {
        it("claims the delivery in one statement and returns the job with the bumped token", async () => {
            const manager = mockEntityManager({
                query: [
                    CLAIM_JOB,
                    [{ id: "j-1", kind: "mail", fencing_token: "3", current_step: null, payload: { id: "m-1" } }],
                ],
            })
            const { claims } = await build(manager)

            const job = await claims.claim({
                kind: "mail",
                jobKey: "k-1",
                payload: { id: "m-1" },
                workerId: "w-1",
                leaseMs: 60000,
            })

            expect(job).toEqual(claimed)
            expect(manager.query).toHaveBeenCalledWith(CLAIM_JOB, [
                "mail",
                "k-1",
                "w-1",
                new Date("2026-02-03T04:06:06.000Z"),
                JSON.stringify({ id: "m-1" }),
                new Date(AT),
            ])
        })

        it("answers null when the job is done or another worker holds a live claim", async () => {
            const manager = mockEntityManager({ query: [CLAIM_JOB, []] })
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
            const manager = mockEntityManager({
                query: [
                    [ADVANCE_JOB, [{ id: "j-1" }]],
                    [COMPLETE_JOB, [{ id: "j-1" }]],
                    [FAIL_JOB, [{ id: "j-1" }]],
                ],
            })
            const { claims } = await build(manager)

            await claims.advance({ jobId: "j-1", expectedFencingToken: 3, step: "send" })
            await claims.complete({ jobId: "j-1", expectedFencingToken: 3 })
            await claims.fail({ jobId: "j-1", expectedFencingToken: 3, reason: "boom" })

            expect(manager.query).toHaveBeenNthCalledWith(1, ADVANCE_JOB, ["j-1", 3, "send", new Date(AT)])
            expect(manager.query).toHaveBeenNthCalledWith(2, COMPLETE_JOB, ["j-1", 3, new Date(AT)])
            expect(manager.query).toHaveBeenNthCalledWith(3, FAIL_JOB, ["j-1", 3, "boom", new Date(AT)])
        })

        it("throws JobFencedOut when a write finds no row at its token: a newer worker owns the job", async () => {
            const manager = mockEntityManager({
                query: [
                    [ADVANCE_JOB, []],
                    [COMPLETE_JOB, []],
                    [FAIL_JOB, []],
                ],
            })
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
            const manager = mockEntityManager({ query: [LOCK_JOB_FENCE, [{ id: "j-1" }]] })
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: JobEffect<string> }>()
            effect.run.mockResolvedValue("sent")

            await expect(claims.withFence(claimed, effect.run)).resolves.toBe("sent")

            expect(manager.query).toHaveBeenCalledWith(LOCK_JOB_FENCE, ["j-1", 3])
            expect(effect.run).toHaveBeenCalledTimes(1)
            expect(effect.run).toHaveBeenCalledWith()
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("rejects a stale token before calling the effect and rolls the transaction back", async () => {
            const manager = mockEntityManager({ query: [LOCK_JOB_FENCE, []] })
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: JobEffect<string> }>()

            await expect(claims.withFence(claimed, effect.run)).rejects.toMatchObject({
                name: "JobsError",
                code: JobsErrorCode.FencedOut,
                params: { jobId: "j-1", token: 3 },
            })

            expect(manager.query).toHaveBeenCalledWith(LOCK_JOB_FENCE, ["j-1", 3])
            expect(effect.run).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["rollback"])
        })

        it("propagates a failed effect and rolls the live fence transaction back", async () => {
            const manager = mockEntityManager({ query: [LOCK_JOB_FENCE, [{ id: "j-1" }]] })
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
            const manager = mockEntityManager({
                query: [LOCK_FAILED_JOB_FENCE, [{ id: "j-failed", fencing_token: "7" }]],
            })
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: FailedJobEffect }>()
            effect.run.mockResolvedValue(undefined)

            await expect(claims.withFailedFence("failed-delivery", effect.run)).resolves.toBeUndefined()

            expect(manager.query).toHaveBeenCalledWith(LOCK_FAILED_JOB_FENCE, ["failed-delivery"])
            expect(effect.run).toHaveBeenCalledTimes(1)
            expect(effect.run).toHaveBeenCalledWith({ jobId: "j-failed", expectedFencingToken: 7 })
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("commits without a terminal effect when no failed claim remains", async () => {
            const manager = mockEntityManager({ query: [LOCK_FAILED_JOB_FENCE, []] })
            const transaction = fakeTransaction(manager)
            const { claims } = await build(manager)
            const effect = mock<{ run: FailedJobEffect }>()

            await expect(claims.withFailedFence("failed-delivery", effect.run)).resolves.toBeUndefined()

            expect(manager.query).toHaveBeenCalledWith(LOCK_FAILED_JOB_FENCE, ["failed-delivery"])
            expect(effect.run).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("propagates a terminal effect failure and rolls the failed fence back", async () => {
            const manager = mockEntityManager({
                query: [LOCK_FAILED_JOB_FENCE, [{ id: "j-failed", fencing_token: "7" }]],
            })
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
