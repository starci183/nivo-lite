import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { REALTIME_RETENTION_QUEUE } from "@modules/queues/realtime-retention"
import { SweepExpiredEventsStep } from "../../steps/sweep-expired-events.step"

@Injectable()
/** The processor of the sweep-realtime-events job: the runner claims and settles every pg_cron tick; `process` delegates the fenced claim to the one step. */
export class SweepRealtimeEventsProcessor extends FencedProcessor {
    readonly queue = REALTIME_RETENTION_QUEUE

    constructor(private readonly sweepExpired: SweepExpiredEventsStep) {
        super()
    }

    /** Sweeps one batch; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.sweepExpired.run(job)
    }
}
