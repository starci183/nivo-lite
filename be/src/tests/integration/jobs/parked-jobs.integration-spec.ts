import assert from "node:assert/strict"
import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { QueueOutboxService } from "@modules/platform/queue"
import { jobsEntities, ParkedJobCloseService, ParkedJobResumerService } from "@modules/platform/jobs"
import { jobsBuilder } from "../../fixtures/builders/jobs.builder"
import { cleanupJobs, jobSnapshot } from "../../world/proof-database.service"
import { JOBS_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

const [JobEntity] = jobsEntities

describe("parked jobs (lite integration)", () => {
    const database = useTestWorld({ modules: [...JOBS_MODULES] })
    beforeAll(() => {
        database.cleanup(() => cleanupJobs(database.db.primary, database.prefix))
    })

    it("fenced-job/park-resume: a parked job is handed back under a new build, keeps its steps and completes once", async () => {
        const manager = database.db.primary
        // A job key is the dedupe key of its outbox row, which the database requires to hold a colon; the resumed key `<jobKey>-r1` keeps it.
        const { claims, claim, delivery } = jobsBuilder(manager, database.key("park:delivery"))
        const first = await claim(claims, "worker-1")
        assert(first !== null)
        await claims.advance({ jobId: first.jobId, expectedFencingToken: first.fencingToken, step: "prepared" })

        const alertDue = await claims.park({
            jobId: first.jobId,
            expectedFencingToken: first.fencingToken,
            failureClass: "code",
            reason: "boom",
            build: "build-1",
            queue: delivery.queue,
        })

        expect(alertDue).toBe(true)
        expect(await jobSnapshot(manager, delivery.id)).toMatchObject({ status: "failed_awaiting_fix", error: "boom" })
        expect(await claim(claims, "worker-2")).toBeNull()

        const resumer = new ParkedJobResumerService(
            [manager],
            {
                connection: "primary",
                workerId: "worker-2",
                leaseMs: 100,
                buildId: "build-2",
                scheduler: { enabled: false },
            },
            new QueueOutboxService(),
            mock<Logger>(),
            new ParkedJobCloseService(mock<Logger>()),
        )
        await expect(resumer.sweep({ build: "build-2" })).resolves.toBe(1)

        const resumed = await manager.findOneByOrFail(JobEntity, { id: first.jobId })
        expect(resumed).toMatchObject({ status: "failed", resumeCount: 1, parkedAt: null, alertedAt: null })
        const second = await claims.claim({
            kind: delivery.queue,
            jobKey: resumed.jobKey,
            payload: delivery.payload,
            workerId: "worker-2",
            leaseMs: 100,
        })
        assert(second !== null)
        expect(second).toMatchObject({
            jobId: first.jobId,
            fencingToken: first.fencingToken + 1,
            currentStep: "prepared",
        })
        expect(claims.runKey(second, "archive")).toBe(`${first.jobId}:archive:${String(second.fencingToken)}`)
        await claims.complete({ jobId: second.jobId, expectedFencingToken: second.fencingToken })
        expect(
            await claims.claim({
                kind: delivery.queue,
                jobKey: resumed.jobKey,
                payload: delivery.payload,
                workerId: "worker-3",
                leaseMs: 100,
            }),
        ).toBeNull()
        expect(await resumer.resumeAll()).toBe(0)
    })
})
