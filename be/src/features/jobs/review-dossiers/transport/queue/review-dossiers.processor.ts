import { Injectable } from "@nestjs/common"
import { DossierReviewRunnerService } from "@modules/domain/dossier-review"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { ReviewDossiersStep } from "../../steps/review-dossiers.step"

@Injectable()
/** The processor of the review-dossiers job: the runner claims and settles it; `process` delegates to the one step. */
export class ReviewDossiersProcessor extends FencedProcessor {
    override readonly queue = KNOWLEDGE_QUEUE
    override readonly job = KnowledgeJob.DossierReview

    constructor(
        private readonly reviewDossiers: ReviewDossiersStep,
        private readonly runner: DossierReviewRunnerService,
    ) {
        super()
    }

    /** Runs the review; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.reviewDossiers.run(job)
    }

    /** The job ended as failed: the run is closed as failed with its error. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.runner.fail(delivery.payload)
    }
}
