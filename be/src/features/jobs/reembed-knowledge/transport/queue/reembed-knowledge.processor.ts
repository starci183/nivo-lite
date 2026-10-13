import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { ReembedStep } from "../../steps/reembed.step"

@Injectable()
/** The processor of the reembed-knowledge job: the runner claims and settles it; `process` delegates to the one step. */
export class ReembedKnowledgeProcessor extends FencedProcessor {
    override readonly queue = KNOWLEDGE_QUEUE
    override readonly job = KnowledgeJob.Reembed

    constructor(private readonly reembed: ReembedStep) {
        super()
    }

    /** Embeds the stale passages; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.reembed.run(job)
    }
}
