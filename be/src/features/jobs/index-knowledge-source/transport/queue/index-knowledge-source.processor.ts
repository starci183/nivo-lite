import { Injectable } from "@nestjs/common"
import { KnowledgeJobsService } from "@modules/domain/knowledge"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { KNOWLEDGE_INDEX_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { IndexSourceStep } from "../../steps/index-source.step"

/**
 * The workspace headroom of an index job: it starts while up to this many more of the workspace's jobs run than the app's limit. The
 * truths work of the same workspace (`knowledge.facts`, `dossier.review`, follow-ups of minutes each) fills the limit for as long as a
 * big upload is read; an index job is a few seconds and makes the document searchable, so it never waits behind that work (D-N-6:
 * "ready as soon as stored"), and while it runs its slot holds the truths work back, never the reverse. Three: above the workspace
 * limit and the one extra slot a truths document with nothing running may take (`job_start` with a fair group).
 */
const INDEX_WORKSPACE_HEADROOM = 3

@Injectable()
/**
 * The processor of the index-knowledge-source job on the index lane (`KNOWLEDGE_INDEX_QUEUE`, workers no truths job holds): the runner
 * claims and settles it; `process` delegates to the one step.
 */
export class IndexKnowledgeSourceProcessor extends FencedProcessor {
    override readonly queue: "knowledge_index" = KNOWLEDGE_INDEX_QUEUE
    override readonly job: KnowledgeJob.Index = KnowledgeJob.Index
    override readonly workspaceHeadroom: number = INDEX_WORKSPACE_HEADROOM

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
