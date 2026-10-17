import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import type { LiteWorld } from "../../world/lite-world.service"
import assert from "node:assert/strict"
import type { ClaimedJob, FencedProcessor } from "@modules/platform/jobs"
import { jobsBuilder } from "../../fixtures/builders/jobs.builder"
import { jobSnapshot, cleanupJobs } from "../../world/proof-database.service"
import { useTestWorld } from "../../world/use-test-world"
import { JOBS_MODULES } from "../../world/test-capabilities.options"

/** Collaboration proofs use the real claim and runner services and the migrated local Supabase job table. */
const registerClaimProof = (database: LiteWorld) => {
    it("fenced-job/claim-bumps-token: expiration lets a successor advance the same row's token", async () => {
        const { clock, claims, successorClaims, claim, delivery } = jobsBuilder(
            database.db.primary,
            database.key("claim"),
        )
        const results = await Promise.all([claim(claims, "worker-1"), claim(successorClaims, "worker-2")])
        const first = results.find((job) => job !== null)
        assert(first !== undefined && first !== null)
        expect(first.fencingToken).toBe(1)
        expect(results.filter((job) => job === null)).toHaveLength(1)

        clock.advance(100)
        expect(await claim(successorClaims, "worker-2")).toBeNull()
        clock.advance(1)
        const successor = await claim(successorClaims, "worker-2")
        assert(successor !== null)

        expect(successor.jobId).toBe(first.jobId)
        expect(successor.fencingToken).toBe(first.fencingToken + 1)
        expect(await jobSnapshot(database.db.primary, delivery.id)).toMatchObject({
            status: "running",
            fencing_token: "2",
        })
        await successorClaims.complete({ jobId: successor.jobId, expectedFencingToken: successor.fencingToken })
        clock.advance(100 + 1)
        expect(await claim(claims, "worker-1")).toBeNull()
    })
}

const registerZombieProof = (database: LiteWorld) => {
    it("fenced-job/zombie-fenced-out: stale writes and settlement preserve successor progress", async () => {
        const { clock, claims, successorClaims, claim, runner, logger, delivery, fencedOutEvent } = jobsBuilder(
            database.db.primary,
            database.key("zombie"),
        )
        const attempts: Array<ClaimedJob> = []
        let release = () => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        let started = () => {}
        const processing = new Promise<void>((resolve) => {
            started = resolve
        })
        const processor: FencedProcessor = {
            queue: delivery.queue,
            onFailed: () => Promise.resolve(),
            process: async (job) => {
                attempts.push(job)
                started()
                await gate
            },
        }
        const pending = runner.run(processor, delivery)
        await processing
        clock.advance(100 + 1)
        const owner = await claim(successorClaims, "worker-2")
        const [zombie] = attempts
        assert(owner !== null && zombie !== undefined)
        const stale = { jobId: zombie.jobId, expectedFencingToken: zombie.fencingToken }
        await successorClaims.advance({
            jobId: owner.jobId,
            expectedFencingToken: owner.fencingToken,
            step: "archived",
        })
        const before = await jobSnapshot(database.db.primary, delivery.id)

        await expect(claims.advance({ ...stale, step: "late" })).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        await expect(claims.complete(stale)).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        await expect(claims.fail({ ...stale, reason: "late failure" })).rejects.toMatchObject({
            code: "JOBS_FENCED_OUT",
        })
        const externalEffect = jest.fn(() => Promise.resolve())
        await expect(claims.withFence(zombie, externalEffect)).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        expect(externalEffect).not.toHaveBeenCalled()
        release()
        await expect(pending).resolves.toBeUndefined()

        expect(await jobSnapshot(database.db.primary, delivery.id)).toEqual(before)
        expect(logger.warn).toHaveBeenCalledWith(fencedOutEvent, { jobId: zombie.jobId })
        expect(logger.error).not.toHaveBeenCalled()
        await successorClaims.complete({ jobId: owner.jobId, expectedFencingToken: owner.fencingToken })
        expect(await jobSnapshot(database.db.primary, delivery.id)).toMatchObject({
            status: "done",
            current_step: "archived",
            fencing_token: "2",
        })
    })
}

const registerRedispatchProof = (database: LiteWorld) => {
    it("fenced-job/redispatch-isolated: retries preserve progress and replace the token and run key", async () => {
        const { claims, runner, delivery } = jobsBuilder(database.db.primary, database.key("redispatch"))
        const attempts: Array<ClaimedJob> = []
        const keys: Array<string> = []
        const providerDown = new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
        const processor: FencedProcessor = {
            queue: delivery.queue,
            onFailed: () => Promise.resolve(),
            process: async (job) => {
                attempts.push(job)
                keys.push(claims.runKey(job, "archive"))
                await claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "prepared" })
                if (attempts.length === 1) throw providerDown
                await claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "archived" })
            },
        }
        await expect(runner.run(processor, delivery)).rejects.toBe(providerDown)
        expect(await jobSnapshot(database.db.primary, delivery.id)).toMatchObject({
            status: "failed",
            error: TestWorldErrorCode.ProviderDown,
            fencing_token: "1",
        })
        await runner.run(processor, { ...delivery, attempt: 2 })
        const [first, second] = attempts
        assert(first !== undefined && second !== undefined)

        expect(second).toMatchObject({
            jobId: first.jobId,
            fencingToken: first.fencingToken + 1,
            currentStep: "prepared",
        })
        expect(keys).toEqual([`${first.jobId}:archive:1`, `${second.jobId}:archive:2`])
        await expect(
            claims.fail({ jobId: first.jobId, expectedFencingToken: first.fencingToken, reason: "late" }),
        ).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        expect(await jobSnapshot(database.db.primary, delivery.id)).toMatchObject({
            status: "done",
            current_step: "archived",
            fencing_token: "2",
            error: null,
        })
        await runner.run(processor, { ...delivery, attempt: 3 })
        expect(attempts).toHaveLength(2)
    })
}

describe("fenced jobs (lite integration)", () => {
    const database = useTestWorld({ modules: [...JOBS_MODULES] })
    beforeAll(() => {
        database.cleanup(() => cleanupJobs(database.db.primary, database.prefix))
    })
    registerClaimProof(database)
    registerZombieProof(database)
    registerRedispatchProof(database)
})
