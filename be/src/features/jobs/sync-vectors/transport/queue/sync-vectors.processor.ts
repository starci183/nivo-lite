import { Injectable } from "@nestjs/common"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { VECTOR_SYNC_QUEUE, VectorSyncJob } from "@modules/queues/vector-sync"
import { SyncRowsStep } from "../../steps/sync-rows.step"

/** The workspace headroom of a sync job: above the truths work's limit and its one fair extra slot. */
const SYNC_WORKSPACE_HEADROOM = 3

@Injectable()
/** The processor of the sync-vectors job: the runner claims and settles it; `process` delegates to the one step. A failure of the vector index throws, so the queue tries the job again; what its retries leave, the reconcile finds. */
export class SyncVectorsProcessor extends FencedProcessor {
    override readonly queue: "vector_sync" = VECTOR_SYNC_QUEUE
    override readonly job: VectorSyncJob.Sync = VectorSyncJob.Sync
    /**
     * A sync job is short (a read, at most a few embedding calls, an upsert): it starts while the workspace runs up to this many jobs
     * beyond its limit, so the truths work of the workspace never holds the vectors back (brain walk 3, D-R-9: waits up to 24 min).
     */
    override readonly workspaceHeadroom: number = SYNC_WORKSPACE_HEADROOM

    constructor(private readonly step: SyncRowsStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
