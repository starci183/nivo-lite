import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { BOOKING_STATUS_QUEUE } from "@modules/queues/booking-status"
import { ApplyStep } from "../../steps/apply.step"

@Injectable()
/** The processor of the apply-booking-status job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class ApplyBookingStatusProcessor extends FencedProcessor {
    readonly queue = BOOKING_STATUS_QUEUE

    constructor(private readonly apply: ApplyStep) {
        super()
    }

    /** Applies the booking change; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.apply.run(job)
    }
}
