import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { CONTINUE_LEAD_GEN_JOB, LEAD_GEN_QUEUE } from "./lead-gen.contracts"
import type { LeadGenContinuePayload } from "./lead-gen.contracts"

@Injectable()
/** The typed producer of the lead generation queue. */
export class LeadGenQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Writes one continuation in the caller's transaction; the same finished step twice is one delivery. */
    enqueue(payload: LeadGenContinuePayload, manager: EntityManager): Promise<void> {
        return this.outbox.write(manager, LEAD_GEN_QUEUE, payload, {
            job: CONTINUE_LEAD_GEN_JOB,
            dedupeKey: `${CONTINUE_LEAD_GEN_JOB}:${payload.step.id}`,
        })
    }
}
