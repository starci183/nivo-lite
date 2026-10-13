import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { LEAD_ACTIONS_QUEUE, RUN_LEAD_ACTION_JOB } from "./lead-actions.contracts"
import type { LeadActionPayload } from "./lead-actions.contracts"

@Injectable()
/** The typed producer of the lead-actions queue. */
export class LeadActionsQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Writes one delivery for the run in the caller's transaction. */
    enqueue(payload: LeadActionPayload, manager: EntityManager): Promise<void> {
        return this.outbox.write(manager, LEAD_ACTIONS_QUEUE, payload, {
            job: RUN_LEAD_ACTION_JOB,
            dedupeKey: `${RUN_LEAD_ACTION_JOB}:${payload.runId}`,
        })
    }
}
