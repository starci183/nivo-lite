import { Injectable } from "@nestjs/common"
import { PublicDraftRunService } from "@modules/domain/public-documents"
import { AdvancingJobStepPolicy, InjectJobClaims, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the public document of the claimed job is written from the internal documents, or the customer question is looked up. */
export class DraftPublicDocumentStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        @InjectJobClaims() claims: JobClaims,
        private readonly drafts: PublicDraftRunService,
    ) {
        super(claims, "draft")
    }

    /** Drafts after the worker's claim has been checked. */
    protected perform(payload: object): Promise<unknown> {
        return this.drafts.generate(payload)
    }
}
