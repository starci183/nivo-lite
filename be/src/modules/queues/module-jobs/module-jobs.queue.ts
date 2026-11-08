import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import {
    MODULE_JOBS_QUEUE,
    RUN_MODULE_JOB,
    type ModuleJobEnqueueOptions,
    type ModuleJobPayload,
} from "./module-jobs.contracts"

@Injectable()
/** The typed producer of the module-jobs queue. */
export class ModuleJobsQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Writes one delivery for the declared job in the caller's transaction; the same dedupe key is one delivery. */
    enqueue(payload: ModuleJobPayload, manager: EntityManager, options: ModuleJobEnqueueOptions): Promise<void> {
        return this.outbox.write(manager, MODULE_JOBS_QUEUE, payload, {
            job: RUN_MODULE_JOB,
            dedupeKey: options.dedupeKey,
            delayMs: options.delayMs,
        })
    }
}
