import { Injectable } from "@nestjs/common"
import { ShiftsAlertsService } from "@modules/domain/shifts"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** Runs one shift-alerts job through the shifts capability: the minute tick, a reminder or a no-show check. */
export class RunShiftsAlertsStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly alerts: ShiftsAlertsService,
    ) {}

    /** Records the step with the token this worker holds first, so a stale token stops here; every job re-checks its shift, so a repeat is safe. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "run" })
        await this.alerts.runJob(job.payload)
    }
}
