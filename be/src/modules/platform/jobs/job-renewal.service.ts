import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob, LeaseHold, LeaseState } from "./jobs.contracts"
import { InjectJobClaims, InjectJobsOptions } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import type { JobsOptions } from "./jobs.options"
import type { JobClaims } from "./jobs.port"

/** The shortest time between two renewals. */
const MIN_BEAT_MS = 1000

@Injectable()
/**
 * Keeps the claim of a job alive while its processor runs. A job whose work outlasts one lease would otherwise be claimed again
 * by another delivery and run twice; renewing three times per lease keeps the claim as long as this worker lives, and a worker that
 * dies stops renewing, so its job is claimed again once the lease lapses.
 */
export class JobRenewalService {
    constructor(
        @InjectJobsOptions() private readonly options: JobsOptions,
        @InjectJobClaims() private readonly claims: JobClaims,
        @InjectTimer() private readonly timer: Timer,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Starts renewing the lease of the job; the answer stops it when the job ends, however it ends. */
    keep(job: ClaimedJob): LeaseHold {
        const state: LeaseState = { cancel: () => undefined, stopped: false }
        const beat = (): void => {
            state.cancel = this.timer.schedule(
                () => {
                    void this.renew(job).then((alive) => {
                        if (alive && !state.stopped) beat()
                    })
                },
                Math.max(MIN_BEAT_MS, Math.floor(this.options.leaseMs / 3)),
            )
        }
        beat()
        return {
            stop: () => {
                state.stopped = true
                state.cancel()
            },
        }
    }

    /** Renews once; answers whether to go on: false only when a newer worker owns the job, since renewing under a stale token can never work again. */
    private async renew(job: ClaimedJob): Promise<boolean> {
        try {
            await this.claims.renew({
                jobId: job.jobId,
                expectedFencingToken: job.fencingToken,
                leaseMs: this.options.leaseMs,
            })
            return true
        } catch (cause) {
            if (cause instanceof JobsError && cause.code === JobsErrorCode.FencedOut) {
                this.logger.warn(JobsLogEvent.FencedOut, { jobId: job.jobId })
                return false
            }
            this.logger.error(JobsLogEvent.LeaseNotRenewed, cause, { jobId: job.jobId })
            return true
        }
    }
}
