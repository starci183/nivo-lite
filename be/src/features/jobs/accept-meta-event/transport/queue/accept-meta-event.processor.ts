import { Injectable } from "@nestjs/common"
import { META_INBOUND_QUEUE } from "@modules/domain/meta-inbox"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { DeliverEventStep } from "../../steps/deliver-event.step"

@Injectable()
/** The processor of the accept-meta-event job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class AcceptMetaEventProcessor extends FencedProcessor {
    readonly queue = META_INBOUND_QUEUE

    constructor(private readonly deliverEvent: DeliverEventStep) {
        super()
    }

    /** Delivers the event; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.deliverEvent.run(job)
    }
}
