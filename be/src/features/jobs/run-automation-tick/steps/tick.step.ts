import { Injectable } from "@nestjs/common"
import { AutomationEngineService } from "@modules/domain/automations"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: one pass of the engine over the due runs. */
export class RunAutomationTickStep implements JobStep {
    constructor(
        private readonly engine: AutomationEngineService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the pass. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "tick" })
        await this.engine.tickNow()
    }
}
