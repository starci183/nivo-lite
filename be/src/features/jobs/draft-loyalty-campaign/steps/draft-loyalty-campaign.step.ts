import { Injectable } from "@nestjs/common"
import { LoyaltyCampaignDraftsService } from "@modules/domain/loyalty-campaigns"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** Runs the campaign's prepared generation under the job's current claim. */
export class DraftLoyaltyCampaignStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly drafts: LoyaltyCampaignDraftsService,
    ) {}

    /** Rejects a stale claim before work; the resulting campaign update checks the same fence again. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "draft" })
        await this.drafts.run(job)
    }

    /** A terminal queue failure makes the campaign pollable as failed. */
    abandon(payload: object): Promise<void> {
        return this.drafts.abandon(payload)
    }
}
