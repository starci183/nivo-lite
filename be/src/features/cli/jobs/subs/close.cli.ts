import { CommandRunner, Option, SubCommand } from "nest-commander"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ParkedJobCloseService } from "@modules/platform/jobs"

/** The options of `jobs close`, as the command line parsed them. */
interface CloseJobsOptions {
    /** Why the job is closed; kept on the job as its error. */
    readonly reason?: string
}

@SubCommand({
    name: "close",
    description: "Close one parked job for good, so it is never resumed (its remaining steps never run)",
    arguments: "<jobId>",
})
/**
 * `cli jobs close <jobId> --reason "<why>"`: hands the id, the reason, stdout and the process's exit code to the jobs capability, which
 * closes a parked job on the primary connection. The id is the job row's (`jobs.id`), not an outbox id.
 */
export class CloseJobsCli extends CommandRunner {
    constructor(
        private readonly closer: ParkedJobCloseService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {
        super()
    }

    /** Closes the job named by the first argument with the reason given. */
    run(params: Array<string>, options: CloseJobsOptions = {}): Promise<void> {
        return this.closer.closeFor(process.stdout, process, this.entityManager, params[0], options.reason)
    }

    /** Why the job is closed. */
    @Option({ flags: "-r, --reason <why>", description: "Why the job is closed; kept on the job", defaultValue: "" })
    parseReason(value: string): string {
        return value
    }
}
