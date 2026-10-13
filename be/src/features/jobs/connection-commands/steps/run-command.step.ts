import { Injectable } from "@nestjs/common"
import { ConnectionCommandsService } from "@modules/domain/connection-commands"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"
import { isConnectionCommandPayload } from "@modules/queues/connection-commands"

@Injectable()
/** The one effect of the job: the submitted console command runs as the member who submitted it and its outcome is written to its row. */
export class RunCommandStep implements JobStep {
    constructor(
        private readonly commands: ConnectionCommandsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the command (a
     * command that already has its outcome is left as it is, so a repeat changes nothing).
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "run" })
        if (isConnectionCommandPayload(job.payload)) await this.commands.run(job.payload.commandId)
    }
}
