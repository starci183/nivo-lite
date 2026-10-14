import { CommandRunner, SubCommand } from "nest-commander"
import { JobOpsConsoleService } from "@modules/domain/job-ops"

@SubCommand({
    name: "retry-failed",
    description: "Requeue jobs that failed in the last hours (default 24)",
    arguments: "[hours]",
})
/** `cli jobs retry-failed [hours]`: delegates the operator command to the job operations console capability. */
export class RetryFailedJobsCli extends CommandRunner {
    constructor(private readonly jobs: JobOpsConsoleService) {
        super()
    }

    /** Hands the positional arguments and output to the console capability without changing them. */
    async run(passedParams: Array<string>): Promise<void> {
        await this.jobs.requeueFailed(passedParams, process.stdout)
    }
}
