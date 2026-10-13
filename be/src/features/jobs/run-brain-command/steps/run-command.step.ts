import { Injectable } from "@nestjs/common"
import { BrainCommandRunnerService, BrainLogEvent } from "@modules/domain/brain"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the command of the claimed job is carried out and its row closed. */
export class RunCommandStep implements JobStep {
    constructor(
        private readonly runner: BrainCommandRunnerService,
        @InjectJobClaims() private readonly claims: JobClaims,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "command" })
        const outcome = await this.runner.run(job.payload)
        this.logger.info(BrainLogEvent.CommandRan, { jobId: job.jobId, outcome })
    }
}
