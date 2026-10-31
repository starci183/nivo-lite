import { Injectable } from "@nestjs/common"
import { DossierRemedyDraftsService } from "@modules/domain/dossier-review"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the draft of the claimed job is written by the model and stored as proposed. */
export class DraftDossierRemedyStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        @InjectJobClaims() claims: JobClaims,
        private readonly drafts: DossierRemedyDraftsService,
    ) {
        super(claims, "draft")
    }

    /** Drafts the remedy after the worker's claim has been checked. */
    protected perform(payload: object): Promise<unknown> {
        return this.drafts.generate(payload)
    }
}
