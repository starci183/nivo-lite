import { Injectable } from "@nestjs/common"
import { LeadActionsService } from "@modules/domain/lead-actions"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced orchestration step of one lead action. */
export class RunLeadActionStep implements JobStep {
    constructor(
        private readonly actions: LeadActionsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Proves the worker fence before any action effect, then runs the stored action and records its result. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "lead-action" })
        await this.claims.withFence(job, () => this.actions.run(job))
    }
}
