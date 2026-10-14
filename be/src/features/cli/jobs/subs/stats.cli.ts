import { CommandRunner, SubCommand } from "nest-commander"
import { JobOpsConsoleService } from "@modules/domain/job-ops"

@SubCommand({ name: "stats", description: "Print the queue and outbox statistics" })
/** `cli jobs stats`: delegates the operator command to the job operations console capability. */
export class StatsJobsCli extends CommandRunner {
    constructor(private readonly jobs: JobOpsConsoleService) {
        super()
    }

    /** Hands the positional arguments and output to the console capability without changing them. */
    async run(passedParams: Array<string>): Promise<void> {
        await this.jobs.stats(passedParams, process.stdout)
    }
}
