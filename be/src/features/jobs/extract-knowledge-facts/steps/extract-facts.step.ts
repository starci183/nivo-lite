import { Injectable } from "@nestjs/common"
import { DocumentFactsService } from "@modules/domain/brain"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the facts of the document of the claimed job are read and filed as proposals. */
export class ExtractFactsStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly documentFacts: DocumentFactsService,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then reads. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "facts" })
        await this.documentFacts.run(job.payload)
    }
}
