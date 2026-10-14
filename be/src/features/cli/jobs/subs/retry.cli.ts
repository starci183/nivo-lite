import { CommandRunner, SubCommand } from "nest-commander"
import { JobOpsConsoleService } from "@modules/domain/job-ops"

@SubCommand({ name: "retry", description: "Requeue one failed job", arguments: "<outboxId>" })
/** `cli jobs retry <outboxId>`: delegates the operator command to the job operations console capability. */
export class RetryJobsCli extends CommandRunner {
    constructor(private readonly jobs: JobOpsConsoleService) {
        super()
    }

    /** Hands the positional arguments and output to the console capability without changing them. */
    async run(passedParams: Array<string>): Promise<void> {
        await this.jobs.requeue(passedParams, process.stdout)
    }
}
