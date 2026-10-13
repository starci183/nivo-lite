import { Injectable } from "@nestjs/common"
import { BookingEffectsService } from "@modules/domain/bookings"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { bookingStatusPayloadOf } from "@modules/queues/booking-status"

@Injectable()
/** The one effect of the job: the booking change the claimed job names is applied (reminders, fees, order hand-off, evidence, customer notice). */
export class ApplyStep implements JobStep {
    constructor(
        private readonly effects: BookingEffectsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then applies the change. Every
     * effect keeps a mark on the booking, so a repeated delivery changes nothing twice. A payload that is not a booking change finds no booking and does nothing.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "apply" })
        await this.effects.apply(bookingStatusPayloadOf(job.payload))
    }
}
