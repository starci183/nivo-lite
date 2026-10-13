import { Injectable } from "@nestjs/common"
import { KnowledgeJobsService } from "@modules/domain/knowledge"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the source of the claimed job is read, cut into passages, embedded and stored. */
export class IndexSourceStep implements JobStep {
    constructor(
        private readonly knowledge: KnowledgeJobsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then indexes. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "index" })
        await this.knowledge.index(job.payload)
    }
}
