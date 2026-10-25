import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_WORKER_REGISTRY, QueueErrorCode } from "@modules/platform/queue"
import type { QueueDelivery, QueueWorkerRegistry } from "@modules/platform/queue"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { FencedProcessor } from "./fenced.processor"
import type { ClaimedJob } from "./jobs.contracts"
import { JOB_CLAIMS, JOBS_OPTIONS } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import type { JobsOptions } from "./jobs.options"
import type { JobClaims } from "./jobs.port"
import { JobRunnerService } from "./job-runner.service"

const options: JobsOptions = { connection: "primary", workerId: "w-1", leaseMs: 60000 }
const delivery: QueueDelivery = {
    id: "k-1",
    queue: "mail",
    job: "mail.send",
    payload: { id: "m-1" },
    attempt: 1,
    signal: new AbortController().signal,
}
const job: ClaimedJob = { jobId: "j-1", kind: "mail", fencingToken: 2, currentStep: null, payload: { id: "m-1" } }
const fenced = (): JobsError => new JobsError({ code: JobsErrorCode.FencedOut, params: { jobId: "j-1", token: 2 } })

const build = async () => {
    const claims = mock<JobClaims>()
    claims.fail.mockResolvedValue(undefined)
    claims.retryAfterSeconds.mockResolvedValue(null)
    const queues = mock<QueueWorkerRegistry>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobRunnerService,
            { provide: JOBS_OPTIONS, useValue: options },
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: QUEUE_WORKER_REGISTRY, useValue: queues },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        runner: moduleRef.get(JobRunnerService),
        claims,
        queues,
        logger,
        processor: mock<FencedProcessor>({ queue: "mail", job: undefined, concurrency: undefined }),
    }
}

describe("JobRunnerService", () => {
    describe("add", () => {
        it("subscribes the processor to its queue, and the handler runs a delivery through the fence", async () => {
            const { runner, claims, queues, processor } = await build()
            claims.claim.mockResolvedValue(job)
            runner.add(processor)
            const handler = queues.add.mock.calls[0]?.[0]

            await handler?.handle(delivery)

            expect(handler?.queue).toBe("mail")
            expect(handler?.job).toBeUndefined()
            expect(processor.process).toHaveBeenCalledWith(job)
        })

        it("subscribes with the job and concurrency and hands failures to the processor", async () => {
            const { runner, queues } = await build()
            const processor = mock<FencedProcessor>({ queue: "mail", job: "mail.send", concurrency: 2 })
            const cause = new Error("gave up")
            runner.add(processor)
            const handler = queues.add.mock.calls[0]?.[0]

            await handler?.failed?.(delivery, cause)

            expect(handler).toMatchObject({ queue: "mail", job: "mail.send", concurrency: 2 })
            expect(processor.onFailed).toHaveBeenCalledWith(delivery, cause)
        })
    })
})

describe("JobRunnerService", () => {
    describe("run", () => {
        it("claims with the job key and lease, processes and completes under the claimed token", async () => {
            const { runner, claims, processor } = await build()
            claims.claim.mockResolvedValue(job)

            await runner.run(processor, delivery)

            expect(claims.claim).toHaveBeenCalledWith({
                kind: "mail",
                jobKey: "k-1",
                payload: { id: "m-1" },
                workerId: "w-1",
                leaseMs: 60000,
            })
            expect(processor.process).toHaveBeenCalledWith(job)
            expect(claims.complete).toHaveBeenCalledWith({ jobId: "j-1", expectedFencingToken: 2 })
            expect(claims.fail).not.toHaveBeenCalled()
        })

        it("claims a processor of one job under the job name as the kind", async () => {
            const { runner, claims } = await build()
            claims.claim.mockResolvedValue(job)
            const processor = mock<FencedProcessor>({ queue: "mail", job: "mail.send" })

            await runner.run(processor, delivery)

            expect(claims.claim).toHaveBeenCalledWith(expect.objectContaining({ kind: "mail.send" }))
        })
    })
})

describe("JobRunnerService", () => {
    describe("refused claims", () => {
        it("acknowledges a refused claim only when the job is confirmed done", async () => {
            const { runner, claims, processor } = await build()
            claims.claim.mockResolvedValue(null)

            await runner.run(processor, delivery)

            expect(processor.process).not.toHaveBeenCalled()
            expect(claims.complete).not.toHaveBeenCalled()
            expect(claims.retryAfterSeconds).toHaveBeenCalledWith(delivery.id)
        })

        it("defers a refused live claim without processing, completing or recording a failure", async () => {
            const { runner, claims, processor } = await build()
            claims.claim.mockResolvedValue(null)
            claims.retryAfterSeconds.mockResolvedValue(42)

            await expect(runner.run(processor, delivery)).rejects.toMatchObject({
                code: QueueErrorCode.DeferredUntil,
                params: { job: delivery.job, seconds: 42 },
            })

            expect(processor.process).not.toHaveBeenCalled()
            expect(claims.complete).not.toHaveBeenCalled()
            expect(claims.fail).not.toHaveBeenCalled()
        })

        it("keeps a failed disposition check retryable instead of acknowledging the delivery", async () => {
            const { runner, claims, processor } = await build()
            const failure = new Error("claim state unavailable")
            claims.claim.mockResolvedValue(null)
            claims.retryAfterSeconds.mockRejectedValue(failure)

            await expect(runner.run(processor, delivery)).rejects.toBe(failure)

            expect(processor.process).not.toHaveBeenCalled()
            expect(claims.complete).not.toHaveBeenCalled()
            expect(claims.fail).not.toHaveBeenCalled()
        })
    })
})

describe("JobRunnerService", () => {
    describe("run failures", () => {
        it("stops further effects when a newer worker fences out a write", async () => {
            const { runner, claims, logger, processor } = await build()
            claims.claim.mockResolvedValue(job)
            claims.complete.mockRejectedValue(fenced())

            await expect(runner.run(processor, delivery)).resolves.toBeUndefined()

            expect(logger.warn).toHaveBeenCalledWith(JobsLogEvent.FencedOut, { jobId: "j-1" })
            expect(claims.fail).not.toHaveBeenCalled()
        })

        it("marks failure under its token and rethrows processor errors for queue retry", async () => {
            const { runner, claims, logger, processor } = await build()
            claims.claim.mockResolvedValue(job)
            const failure = new Error("provider down")
            processor.process.mockRejectedValue(failure)

            await expect(runner.run(processor, delivery)).rejects.toBe(failure)

            expect(claims.fail).toHaveBeenCalledWith({ jobId: "j-1", expectedFencingToken: 2, reason: "provider down" })
            expect(logger.error).toHaveBeenCalledWith(JobsLogEvent.DeliveryFailed, failure, { jobId: "j-1" })
        })

        it("records a thrown value that is not an Error by its text", async () => {
            const { runner, claims, processor } = await build()
            claims.claim.mockResolvedValue(job)
            processor.process.mockRejectedValue("plain text")

            await expect(runner.run(processor, delivery)).rejects.toBe("plain text")

            expect(claims.fail).toHaveBeenCalledWith({ jobId: "j-1", expectedFencingToken: 2, reason: "plain text" })
        })
    })
})

describe("JobRunnerService", () => {
    describe("run", () => {
        it("rethrows the original failure when recording is fenced out and logs other recording failures", async () => {
            const { runner, claims, logger, processor } = await build()
            claims.claim.mockResolvedValue(job)
            const failure = new Error("provider down")
            processor.process.mockRejectedValue(failure)
            claims.fail.mockRejectedValueOnce(fenced())

            await expect(runner.run(processor, delivery)).rejects.toBe(failure)
            expect(logger.warn).toHaveBeenCalledWith(JobsLogEvent.FencedOut, { jobId: "j-1" })

            const storeDown = new Error("store down")
            claims.fail.mockRejectedValueOnce(storeDown)

            await expect(runner.run(processor, delivery)).rejects.toBe(failure)
            expect(logger.error).toHaveBeenCalledWith(JobsLogEvent.FailureNotRecorded, storeDown, { jobId: "j-1" })
        })
    })
})
