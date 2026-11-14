import { Injectable } from "@nestjs/common"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { VECTOR_SYNC_QUEUE, VectorSyncJob } from "@modules/queues/vector-sync"
import { ReconcileRunStep } from "../../steps/reconcile-run.step"

@Injectable()
/** The processor of the reconcile-vectors job (the tick `vector-reconcile` and the follow-up of a run that used its budget): the runner claims and settles it; `process` delegates to the one step. The run itself never throws for the index: it counts the failure and the next run goes on. */
export class ReconcileVectorsProcessor extends FencedProcessor {
    override readonly queue: "vector_sync" = VECTOR_SYNC_QUEUE
    override readonly job: VectorSyncJob.Reconcile = VectorSyncJob.Reconcile

    constructor(private readonly step: ReconcileRunStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
