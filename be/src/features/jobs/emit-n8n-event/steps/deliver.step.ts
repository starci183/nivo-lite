import { Injectable } from "@nestjs/common"
import { N8nRunsService } from "@modules/domain/n8n-runs"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the signed delivery of one run to its workflows. */
export class EmitN8nEventStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        private readonly runs: N8nRunsService,
        @InjectJobClaims() claims: JobClaims,
    ) {
        super(claims, "deliver")
    }

    /** Delivers the run after its step is recorded; an unreachable n8n marks the run failed in the domain. */
    protected perform(payload: object): Promise<unknown> {
        return this.runs.deliver(payload)
    }
}
