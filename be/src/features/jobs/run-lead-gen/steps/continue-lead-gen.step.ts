import { Injectable } from "@nestjs/common"
import { LeadFlowContinuationService } from "@modules/domain/lead-flows"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced step of one lead generation continuation: the next command of the flow, then the steps its input queued. */
export class ContinueLeadGenStep implements JobStep {
    constructor(
        private readonly continuation: LeadFlowContinuationService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Proves the worker fence before any effect; every command it sends is idempotent by its dedupe key. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "continue" })
        await this.continuation.continue(job.payload)
    }
}
