import { Injectable } from "@nestjs/common"
import { DocumentFactsService } from "@modules/domain/brain"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the facts of the document of the claimed job are read and filed as proposals. */
export class ExtractFactsStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        @InjectJobClaims() claims: JobClaims,
        private readonly documentFacts: DocumentFactsService,
    ) {
        super(claims, "facts")
    }

    /** Reads document facts after the worker's claim has been checked. */
    protected perform(payload: object): Promise<unknown> {
        return this.documentFacts.run(payload)
    }
}
