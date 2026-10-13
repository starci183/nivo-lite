import { Injectable } from "@nestjs/common"
import { AutomationCommandsService } from "@modules/domain/automation-commands"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the command a manager queued from the screen, run and answered on its row. */
export class RunCommandStep implements JobStep {
    constructor(
        private readonly commands: AutomationCommandsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the command. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "command" })
        await this.commands.execute(job.payload)
    }
}
