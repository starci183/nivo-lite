import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { JobOpsError, JobOpsErrorCode } from "./errors/job-ops.error"
import { JOB_TICKS } from "./job-tick.policy"

@Injectable()
/** Sends operator ticks through the transactional producer, deduplicated per scheduler cadence window. */
export class JobTickService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Validates the migration job id and atomically enqueues one tick; retries in the same window are harmless. */
    async tick(id: string): Promise<void> {
        const tick = Object.hasOwn(JOB_TICKS, id) ? JOB_TICKS[id] : undefined
        if (tick === undefined) throw new JobOpsError({ code: JobOpsErrorCode.TickIdInvalid })
        const window = Math.floor(this.clock.now().getTime() / (tick.minutes * 60_000))
        await this.entityManager.transaction((tx) =>
            this.outbox.write(tx, tick.queue, tick.payload, { job: tick.job, dedupeKey: `jobs.tick:${id}:${window}` }),
        )
    }
}
