import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectQueueWorkerRegistry, QueueError, QueueErrorCode } from "@modules/platform/queue"
import type { QueueDelivery, QueueWorkerRegistry } from "@modules/platform/queue"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob } from "./jobs.contracts"
import { InjectJobClaims, InjectJobsOptions } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import type { JobsOptions } from "./jobs.options"
import type { JobClaims, JobProcessorRegistry } from "./jobs.port"
import { JobRenewalService } from "./job-renewal.service"
import type { FencedProcessor } from "./fenced.processor"

const isFencedOut = (cause: unknown): boolean => cause instanceof JobsError && cause.code === JobsErrorCode.FencedOut

@Injectable()
/**
 * The runner of fenced jobs: it subscribes each registered processor to its queue and, for every delivery, claims the job (bumping the
 * fencing token), calls the processor and settles the job through the guarded writes. A `JobFencedOut` means a newer worker owns the
 * job: this worker stops with no further effect and the delivery is acknowledged. A refused claim acknowledges only a confirmed
 * done row; a live claim defers the delivery until its lease expires. The lease is renewed while the processor runs, so a long job is
 * never claimed again beside itself. Any other failure marks the job failed and is rethrown, so the
 * queue retries the delivery and the next claim bumps the token again.
 */
export class JobRunnerService implements JobProcessorRegistry {
    constructor(
        @InjectJobsOptions() private readonly options: JobsOptions,
        @InjectJobClaims() private readonly claims: JobClaims,
        @InjectQueueWorkerRegistry() private readonly queues: QueueWorkerRegistry,
        @InjectLogger() private readonly logger: Logger,
        private readonly renewals: JobRenewalService,
    ) {}

    /** Subscribes the processor to its queue and job. */
    add(processor: FencedProcessor): void {
        this.queues.add({
            queue: processor.queue,
            job: processor.job,
            concurrency: processor.concurrency,
            scheduled: processor.scheduled,
            handle: (delivery) => this.run(processor, delivery),
            failed: (delivery, cause) => processor.onFailed(delivery, cause),
        })
    }

    /** Runs one delivery of the processor's queue. */
    async run(processor: FencedProcessor, delivery: QueueDelivery): Promise<void> {
        const job = await this.claims.claim({
            kind: processor.job ?? processor.queue,
            jobKey: delivery.id,
            payload: delivery.payload,
            workerId: this.options.workerId,
            leaseMs: this.options.leaseMs,
        })
        if (job === null) {
            const seconds = await this.claims.retryAfterSeconds(delivery.id)
            if (seconds !== null) {
                throw new QueueError({
                    code: QueueErrorCode.DeferredUntil,
                    params: { job: delivery.job, seconds },
                })
            }
            return
        }
        const hold = this.renewals.keep(job)
        try {
            await processor.process(job)
            await this.claims.complete({ jobId: job.jobId, expectedFencingToken: job.fencingToken })
        } catch (cause) {
            if (isFencedOut(cause)) {
                this.logger.warn(JobsLogEvent.FencedOut, { jobId: job.jobId })
                return
            }
            await this.recordFailure(job, cause)
            throw cause
        } finally {
            hold.stop()
        }
    }

    private async recordFailure(job: ClaimedJob, cause: unknown): Promise<void> {
        const reason = cause instanceof Error ? cause.message : String(cause)
        this.logger.error(JobsLogEvent.DeliveryFailed, cause, { jobId: job.jobId })
        await this.claims
            .fail({ jobId: job.jobId, expectedFencingToken: job.fencingToken, reason })
            .catch((error_: unknown) => {
                if (isFencedOut(error_)) this.logger.warn(JobsLogEvent.FencedOut, { jobId: job.jobId })
                else this.logger.error(JobsLogEvent.FailureNotRecorded, error_, { jobId: job.jobId })
            })
    }
}
