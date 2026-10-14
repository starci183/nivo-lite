import { CommandRunner, SubCommand } from "nest-commander"
import { JobOpsConsoleService } from "@modules/domain/job-ops"

@SubCommand({ name: "watchdog", description: "Print the watchdog job health counters" })
/** `cli jobs watchdog`: delegates the operator command to the job operations console capability. */
export class WatchdogJobsCli extends CommandRunner {
    constructor(private readonly jobs: JobOpsConsoleService) {
        super()
    }

    /** Hands the positional arguments and output to the console capability without changing them. */
    async run(passedParams: Array<string>): Promise<void> {
        await this.jobs.watchdog(passedParams, process.stdout)
    }
}
