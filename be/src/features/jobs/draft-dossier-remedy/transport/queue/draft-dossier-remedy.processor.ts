import { Injectable } from "@nestjs/common"
import { DossierRemedyDraftsService } from "@modules/domain/dossier-review"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { DraftDossierRemedyStep } from "../../steps/draft-dossier-remedy.step"

@Injectable()
/** The processor of the draft-dossier-remedy job: the runner claims and settles it; `process` delegates to the one step. */
export class DraftDossierRemedyProcessor extends FencedProcessor {
    override readonly queue = KNOWLEDGE_QUEUE
    override readonly job = KnowledgeJob.DossierRemedy

    constructor(
        private readonly draftRemedy: DraftDossierRemedyStep,
        private readonly drafts: DossierRemedyDraftsService,
    ) {
        super()
    }

    /** Drafts the remedy; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.draftRemedy.run(job)
    }

    /** The job ended as failed: the draft is marked failed so the owner can ask again. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.drafts.fail(delivery.payload)
    }
}
