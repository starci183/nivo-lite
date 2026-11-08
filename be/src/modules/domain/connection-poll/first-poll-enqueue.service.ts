import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import type { FirstPollTarget } from "./poll-schedule.contracts"
import { PollScheduleService } from "./poll-schedule.service"

@Injectable()
/** Writes the one-connection reconcile job of a connection that just became ready and makes the scheduler poll it hot, for any provider's queue. */
export class FirstPollEnqueueService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly schedule: PollScheduleService,
    ) {}

    /** Enqueues the job on the target queue; the delivery's dedupe key is the job's, so a redelivery is one job. */
    async enqueue(target: FirstPollTarget): Promise<void> {
        const { queue, job, ready } = target
        const payload = { connectionId: ready.connectionId, workspaceId: ready.workspaceId }
        await this.entityManager.transaction((tx) =>
            this.outbox.write(tx, queue, payload, { job, dedupeKey: `${queue}:ready:${ready.dedupeKey}` }),
        )
        await this.schedule.markReady(ready.connectionId)
    }
}
