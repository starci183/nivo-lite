import { Injectable } from "@nestjs/common"
import { LeadFlowContinuationService } from "@modules/domain/lead-flows"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced step of one lead generation continuation: the next command of the flow, then the steps its input queued. */
export class ContinueLeadGenStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        private readonly continuation: LeadFlowContinuationService,
        @InjectJobClaims() claims: JobClaims,
    ) {
        super(claims, "continue")
    }

    /** Continues the flow after the claim is checked; every command is idempotent by its dedupe key. */
    protected perform(payload: object): Promise<unknown> {
        return this.continuation.continue(payload)
    }
}
