import { Injectable } from "@nestjs/common"
import { InviteCommandsService } from "@modules/domain/workspace-invites"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the invitation the web app asked for is created, sent again, linked or re-issued by the platform team, and the asker finds the answer on the command row. */
export class IssueInviteStep implements JobStep {
    constructor(
        private readonly commands: InviteCommandsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then serves the command (a
     * refusal of the domain settles it as failed, any other failure is thrown so the queue retries the delivery).
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "issue" })
        await this.commands.run(job.payload)
    }

    /** Settles the command of a job that ran out of attempts, so the asker stops waiting. */
    async abandon(payload: object): Promise<void> {
        await this.commands.abandon(payload)
    }
}
