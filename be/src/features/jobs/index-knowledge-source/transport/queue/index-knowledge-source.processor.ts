import { Injectable } from "@nestjs/common"
import { KnowledgeJobsService } from "@modules/domain/knowledge"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { IndexSourceStep } from "../../steps/index-source.step"

@Injectable()
/** The processor of the index-knowledge-source job: the runner claims and settles it; `process` delegates to the one step. */
export class IndexKnowledgeSourceProcessor extends FencedProcessor {
    override readonly queue = KNOWLEDGE_QUEUE
    override readonly job = KnowledgeJob.Index

    constructor(
        private readonly indexSource: IndexSourceStep,
        private readonly knowledge: KnowledgeJobsService,
    ) {
        super()
    }

    /** Indexes the source; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.indexSource.run(job)
    }

    /** The job ended as failed: the source is closed with the stored code of the cause. */
    override async onFailed(delivery: QueueDelivery, cause: unknown): Promise<void> {
        await this.knowledge.indexFailed(delivery.payload, cause)
    }
}
