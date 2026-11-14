import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { JobsLogEvent } from "./jobs.log-events"
import { JobEntity } from "./persistence/entities"

/** Where an operator command prints (a process's `stdout`). */
export interface CommandOutput {
    /** Writes the text. */
    write(text: string): unknown
}

/** What an operator command sets its exit code on (the `process`). */
export interface CommandExit {
    /** The exit code the process ends with. */
    exitCode?: number | string | null | undefined
}

/** The id of a job row. */
const JOB_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu

/** What a closed job keeps as its error: that a person closed it, and why. */
export const closedErrorOf = (reason: string): string => `closed: ${reason}`

@Injectable()
/**
 * Closes a parked job for good, on a person's word: the row leaves `failed_awaiting_fix` for `failed` with the reason as its error, so
 * the sweep (which hands back parked jobs only) never picks it up again and its remaining steps never run. Only a parked job can be
 * closed: one that is running, done, or was just handed back to its queue is refused and left as it is. The change is one conditional
 * update of the row, so it waits for a resume that holds the row and then finds it no longer parked. It needs nothing but the
 * connection that holds the jobs, so an operator command can use it in an app that runs no jobs.
 */
export class ParkedJobCloseService {
    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** Closes one parked job with the reason given; false when the id is not a parked job (nothing is changed). */
    async close(manager: EntityManager, jobId: string, reason: string): Promise<boolean> {
        const closed = await manager.update(
            JobEntity,
            { id: jobId, status: "failed_awaiting_fix" },
            { status: "failed", error: closedErrorOf(reason), parkedBuild: null, parkedAt: null },
        )
        if ((closed.affected ?? 0) === 0) return false
        this.logger.info(JobsLogEvent.Closed, { jobId, reason })
        return true
    }

    /**
     * `cli jobs close <jobId> --reason "<why>"`: closes the parked job the id names and prints that it did. An id that is no id, a missing
     * reason and a job that is not parked close nothing; each says so on `out` and sets a failing exit code, so a script that closes a
     * list stops on the first one that did not close.
     */
    async closeFor(
        out: CommandOutput,
        exit: CommandExit,
        manager: EntityManager,
        jobId: string | undefined,
        reason: string | undefined,
    ): Promise<void> {
        const id = jobId ?? ""
        const why = reason?.trim() ?? ""
        if (!JOB_ID.test(id)) return this.refused(out, exit, `not a job id: ${id}`)
        if (why === "") return this.refused(out, exit, 'a reason is required: --reason "<why>"')
        if (!(await this.close(manager, id, why))) return this.refused(out, exit, `not a parked job: ${id}`)
        out.write(`closed ${id}\n`)
    }

    /** Says why nothing was closed and makes the command fail. */
    private refused(out: CommandOutput, exit: CommandExit, why: string): void {
        out.write(`${why}\n`)
        exit.exitCode = 1
    }
}
