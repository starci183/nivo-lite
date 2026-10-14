import { CommandRunner, SubCommand } from "nest-commander"
import { JobOpsConsoleService } from "@modules/domain/job-ops"

@SubCommand({ name: "open", description: "Print the oldest queued or running jobs (default 20)", arguments: "[limit]" })
/** `cli jobs open [limit]`: delegates the operator command to the job operations console capability. */
export class OpenJobsCli extends CommandRunner {
    constructor(private readonly jobs: JobOpsConsoleService) {
        super()
    }

    /** Hands the positional arguments and output to the console capability without changing them. */
    async run(passedParams: Array<string>): Promise<void> {
        await this.jobs.open(passedParams, process.stdout)
    }
}
