import { Injectable } from "@nestjs/common"
import { DocumentFactsService } from "@modules/domain/brain"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { ExtractFactsStep } from "../../steps/extract-facts.step"

@Injectable()
/** The processor of the extract-knowledge-facts job: the runner claims and settles it; `process` delegates to the one step. */
export class ExtractKnowledgeFactsProcessor extends FencedProcessor {
    override readonly queue = KNOWLEDGE_QUEUE
    override readonly job = KnowledgeJob.Facts

    constructor(
        private readonly extractFacts: ExtractFactsStep,
        private readonly documentFacts: DocumentFactsService,
    ) {
        super()
    }

    /** Reads the facts; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.extractFacts.run(job)
    }

    /** The job ended as failed: the document is kept and ready, with a note that its facts were not read. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.documentFacts.giveUp(delivery.payload)
    }
}
