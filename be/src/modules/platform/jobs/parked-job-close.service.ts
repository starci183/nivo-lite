import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { JobsLogEvent } from "./jobs.log-events"
import { JobEntity } from "./persistence/entities"

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
}
