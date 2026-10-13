import { Injectable } from "@nestjs/common"
import { AutomationTickService } from "@modules/domain/automations"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** Runs the fenced tick through the automation capability. */
export class RunAutomationTickStep implements JobStep {
    constructor(
        private readonly tick: AutomationTickService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the fenced step before the capability dispatches the queued payload. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "tick" })
        await this.tick.run(job.payload)
    }
}
