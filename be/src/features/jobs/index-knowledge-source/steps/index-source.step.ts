import { Injectable } from "@nestjs/common"
import { KnowledgeJobsService } from "@modules/domain/knowledge"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the source of the claimed job is read, cut into passages, embedded and stored. */
export class IndexSourceStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        private readonly knowledge: KnowledgeJobsService,
        @InjectJobClaims() claims: JobClaims,
    ) {
        super(claims, "index")
    }

    /** Indexes the source after the worker's claim has been checked. */
    protected perform(payload: object): Promise<unknown> {
        return this.knowledge.index(payload)
    }
}
