import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { DECISIONS_QUEUE, DecisionsJob, decisionsDedupeKey } from "./decisions.contracts"
import type {
    ConfirmCommandPayload,
    DecideExecutionPayload,
    DecideWorkPayload,
    ProposeCommandPayload,
    SimulateInboundPayload,
} from "./decisions.contracts"

@Injectable()
/** The typed producer of the decisions queue: the way the back end itself starts a decision (the web app starts them through SQL). */
export class DecisionsQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the decision of a work item in the caller's transaction. */
    enqueueDecideWork(payload: DecideWorkPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.DecideWork,
            dedupeKey: decisionsDedupeKey(DecisionsJob.DecideWork, payload.workItemId),
        })
    }

    /** Enqueues the decision of an approval card in the caller's transaction. */
    enqueueDecideExecution(payload: DecideExecutionPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.DecideExecution,
            dedupeKey: decisionsDedupeKey(DecisionsJob.DecideExecution, payload.executionId),
        })
    }

    /** Enqueues the proposal of a command card for an Office message in the caller's transaction. */
    enqueueProposeCommand(payload: ProposeCommandPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.ProposeCommand,
            dedupeKey: decisionsDedupeKey(DecisionsJob.ProposeCommand, payload.messageId),
        })
    }

    /** Enqueues the sending of a confirmed command card in the caller's transaction. */
    enqueueConfirmCommand(payload: ConfirmCommandPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.ConfirmCommand,
            dedupeKey: decisionsDedupeKey(DecisionsJob.ConfirmCommand, payload.candidateId),
        })
    }

    /** Enqueues the simulator's department work in the transaction that records its inbound event. */
    enqueueSimulateInbound(payload: SimulateInboundPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, DECISIONS_QUEUE, payload, {
            job: DecisionsJob.SimulateInbound,
            dedupeKey: decisionsDedupeKey(DecisionsJob.SimulateInbound, payload.inboundEventId),
        })
    }
}
