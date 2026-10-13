import { Injectable } from "@nestjs/common"
import { KnowledgeJobsService } from "@modules/domain/knowledge"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the stale passages of the workspace of the claimed job get vectors of the model in use. */
export class ReembedStep implements JobStep {
    constructor(
        private readonly knowledge: KnowledgeJobsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then embeds. */
    async run(job: ClaimedJob): Promise<void> {
        const guard = { jobId: job.jobId, expectedFencingToken: job.fencingToken }
        await this.claims.advance({ ...guard, step: "reembed" })
        await this.knowledge.reembed(job.payload)
    }
}
