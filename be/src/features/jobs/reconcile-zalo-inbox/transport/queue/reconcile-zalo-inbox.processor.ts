import { Injectable } from "@nestjs/common"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { ZALO_INBOX_POLL_QUEUE } from "@modules/queues/zalo-inbox-poll"
import { ReconcileInboxStep } from "../../steps/reconcile-inbox.step"

@Injectable()
/** The processor of the reconcile-zalo-inbox job: every scheduler tick, and every connection that became ready, runs the one step. */
export class ReconcileZaloInboxProcessor extends FencedProcessor {
    readonly queue: "zalo-inbox-poll" = ZALO_INBOX_POLL_QUEUE

    constructor(private readonly reconcile: ReconcileInboxStep) {
        super()
    }

    /** Reads the Zalo inboxes back; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.reconcile.run(job)
    }
}
