import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalQueueJobStatus, QueueJobStatus } from "./queue.contracts"
import { JOB_STATUS } from "./persistence/queue.sql"

@Injectable()
/** Reads authoritative queue state without granting access to the queue's internal tables. */
export class QueueStatusService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Reads one workspace's job by its stable dedupe key; retries remain queued until finally archived. */
    async status(workspaceId: string, queue: string, dedupeKey: string): Promise<OptionalQueueJobStatus> {
        const [row] = await this.entityManager.query<Array<QueueJobStatus>>(JOB_STATUS, [workspaceId, queue, dedupeKey])
        return row ?? null
    }
}
