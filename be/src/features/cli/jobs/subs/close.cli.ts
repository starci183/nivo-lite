import { CommandRunner, Option, SubCommand } from "nest-commander"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ParkedJobCloseService } from "@modules/platform/jobs"

/** The options of `jobs close`, as the command line parsed them. */
interface CloseJobsOptions {
    /** Why the job is closed; kept on the job as its error. */
    readonly reason: string
}

/** The id of a job row. */
const JOB_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu

@SubCommand({
    name: "close",
    description: "Close one parked job for good, so it is never resumed (its remaining steps never run)",
    arguments: "<jobId>",
})
/**
 * `cli jobs close <jobId> --reason "<why>"`: closes a parked job (`failed_awaiting_fix`) through the jobs capability. The id is the
 * job row's (`jobs.id`), not an outbox id. A job that is not parked, an id that is no id and a missing reason close nothing; each says
 * so and sets a failing exit code, so a script that closes a list stops on the first one that did not close.
 */
export class CloseJobsCli extends CommandRunner {
    constructor(
        private readonly closer: ParkedJobCloseService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {
        super()
    }

    /** Closes the job named by the first argument with the reason given. */
    async run([jobId = ""]: Array<string>, options?: CloseJobsOptions): Promise<void> {
        const reason = options?.reason.trim() ?? ""
        if (!JOB_ID.test(jobId)) return this.refused(`not a job id: ${jobId}`)
        if (reason === "") return this.refused('a reason is required: --reason "<why>"')
        const closed = await this.closer.close(this.entityManager, jobId, reason)
        if (!closed) return this.refused(`not a parked job: ${jobId}`)
        process.stdout.write(`closed ${jobId}\n`)
    }

    /** Why the job is closed. */
    @Option({ flags: "-r, --reason <why>", description: "Why the job is closed; kept on the job", defaultValue: "" })
    parseReason(value: string): string {
        return value
    }

    /** Says why nothing was closed and makes the command fail. */
    private refused(why: string): void {
        process.stdout.write(`${why}\n`)
        process.exitCode = 1
    }
}
