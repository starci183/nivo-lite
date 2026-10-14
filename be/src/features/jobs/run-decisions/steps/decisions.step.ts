import { Injectable } from "@nestjs/common"
import { DecisionsQueueService } from "@modules/domain/office-command-candidates"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one step of a job of the decisions queue. */
export class DecisionsStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        private readonly queue: DecisionsQueueService,
        @InjectJobClaims() claims: JobClaims,
    ) {
        super(claims, "decide")
    }

    /** Performs the work named by the payload after the worker's claim has been checked. */
    protected perform(payload: object): Promise<unknown> {
        return this.queue.handle(payload)
    }
}
