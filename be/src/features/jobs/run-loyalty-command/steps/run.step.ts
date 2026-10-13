import { Injectable } from "@nestjs/common"
import { LoyaltyCommandsService } from "@modules/domain/loyalty"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { loyaltyCommandPayloadOf } from "@modules/queues/loyalty-command"

@Injectable()
/** The one effect of the job: the loyalty command the claimed job names is run and its answer written on the row. */
export class RunStep implements JobStep {
    constructor(
        private readonly commands: LoyaltyCommandsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the command. A command
     * that is already settled is skipped, and points move on a key made from the command id, so a repeated delivery changes nothing twice.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "run" })
        const payload = loyaltyCommandPayloadOf(job.payload)
        if (payload === null) return
        await this.commands.run(payload)
    }
}
