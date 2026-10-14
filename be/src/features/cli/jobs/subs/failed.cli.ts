import { CommandRunner, SubCommand } from "nest-commander"
import { JobOpsConsoleService } from "@modules/domain/job-ops"

@SubCommand({ name: "failed", description: "Print the latest failed jobs (default 20)", arguments: "[limit]" })
/** `cli jobs failed [limit]`: delegates the operator command to the job operations console capability. */
export class FailedJobsCli extends CommandRunner {
    constructor(private readonly jobs: JobOpsConsoleService) {
        super()
    }

    /** Hands the positional arguments and output to the console capability without changing them. */
    async run(passedParams: Array<string>): Promise<void> {
        await this.jobs.failed(passedParams, process.stdout)
    }
}
