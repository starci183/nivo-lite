import assert from "node:assert/strict"
import { JOB_CLAIMS, JobRunnerService } from "@modules/platform/jobs"
import type { ClaimedJob, FencedProcessor, JobClaims } from "@modules/platform/jobs"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { jobSnapshot } from "../../world/proof-database.service"
import { worldIds } from "../../world/lite-world.service"
import { redisJobsModules } from "../../world/redis-capabilities.options"
import {
    cleanFencingRows,
    fencingOutbox,
    startQueueRelay,
    transportOf,
    waitForProof,
} from "../../world/redis-proof.service"
import { useTestWorld } from "../../world/use-test-world"

describe("Queue fenced claim recovery (private Redis and local Supabase)", () => {
    const world = useTestWorld({ modules: redisJobsModules(`fencing-${worldIds.next()}`, 1000) })

    it("defers a foreign live claim without completing or spending an attempt, then runs after its lease lapses", async () => {
        const queue = world.key("fenced-queue")
        const dedupeKey = `fencing:${world.key("foreign-lease")}`
        const payload = { proofId: dedupeKey }
        await world.db.primary.transaction((tx) =>
            world.resolve<QueueOutbox>(QUEUE_OUTBOX).write(tx, queue, payload, { dedupeKey }),
        )
        const read = () => fencingOutbox(world.db.primary, dedupeKey)
        const [row] = await read()
        assert(row !== undefined)
        world.cleanup(async () => {
            await cleanFencingRows(world.db.primary, row.id)
        })
        const claims = world.resolve<JobClaims>(JOB_CLAIMS)
        const foreign = await claims.claim({ kind: queue, jobKey: row.id, payload, workerId: "foreign", leaseMs: 2000 })
        assert(foreign !== null)
        const processed: Array<ClaimedJob> = []
        const processor: FencedProcessor = {
            queue,
            process: (job) => {
                processed.push(job)
                return Promise.resolve()
            },
            onFailed: () => Promise.resolve(),
        }
        const runner = world.resolve(JobRunnerService)
        const transport = transportOf(world)
        await transport.work({ queue, handle: (delivery) => runner.run(processor, delivery) }, 1)
        startQueueRelay(world)
        await waitForProof(
            () => transport.stateOf(queue, row.id),
            (state) => state === "delayed",
        )
        expect(await read()).toEqual([{ id: row.id, state: "queued", attempts: 0 }])
        expect(await jobSnapshot(world.db.primary, row.id)).toMatchObject({ status: "running", fencing_token: "1" })
        expect(processed).toHaveLength(0)

        await waitForProof(read, (rows) => rows[0]?.state === "done")
        await waitForProof(
            () => transport.stateOf(queue, row.id),
            (state) => state === "completed",
        )
        expect(await read()).toEqual([{ id: row.id, state: "done", attempts: 1 }])
        expect(processed).toHaveLength(1)
        expect(processed[0]).toMatchObject({ jobId: foreign.jobId, fencingToken: 2 })
        expect(await jobSnapshot(world.db.primary, row.id)).toMatchObject({ status: "done", fencing_token: "2" })
        await expect(claims.complete({ jobId: foreign.jobId, expectedFencingToken: 1 })).rejects.toMatchObject({
            code: "JOBS_FENCED_OUT",
        })
        await runner.run(processor, {
            id: row.id,
            queue,
            job: queue,
            payload,
            attempt: 2,
            signal: new AbortController().signal,
        })
        expect(processed).toHaveLength(1)
    }, 30000)
})
