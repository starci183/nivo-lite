import { Injectable } from "@nestjs/common"
import { PublicDraftRunService } from "@modules/domain/public-documents"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { DraftPublicDocumentStep } from "../../steps/draft-public-document.step"

@Injectable()
/** The processor of the draft-public-document job: the runner claims and settles it; `process` delegates to the one step. */
export class DraftPublicDocumentProcessor extends FencedProcessor {
    override readonly queue: "knowledge" = KNOWLEDGE_QUEUE
    override readonly job: KnowledgeJob.PublicDraft = KnowledgeJob.PublicDraft

    constructor(
        private readonly draftDocument: DraftPublicDocumentStep,
        private readonly drafts: PublicDraftRunService,
    ) {
        super()
    }

    /** Drafts the document; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.draftDocument.run(job)
    }

    /** The job ended as failed: an owner's draft says so and can be asked again; a proposal nobody asked for is dropped. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.drafts.fail(delivery.payload)
    }
}
