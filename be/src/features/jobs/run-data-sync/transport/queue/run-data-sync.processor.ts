import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { DATA_SYNC_QUEUE } from "@modules/queues/data-sync"
import { RunDataSyncStep } from "../../steps/run-data-sync.step"

@Injectable()
/** The processor of the run-data-sync job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class RunDataSyncProcessor extends FencedProcessor {
    readonly queue = DATA_SYNC_QUEUE

    constructor(private readonly run: RunDataSyncStep) {
        super()
    }

    /** Runs the tick or the sync; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.run.run(job)
    }

    /** The job ended as failed: its run is settled as failed so the owner is told. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.run.abandon(delivery.payload)
    }
}
