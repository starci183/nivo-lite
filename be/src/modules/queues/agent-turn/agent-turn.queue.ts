import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import {
    AGENT_TURN_QUEUE,
    AgentTurnJob,
    agentTurnNextKey,
    agentTurnSweepKey,
    agentTurnWakeKey,
} from "./agent-turn.contracts"
import type { AgentTurnDrainPayload } from "./agent-turn.contracts"

@Injectable()
/** The typed producer of the agent-turn queue: the one way a drain job starts. */
export class AgentTurnQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the drain a new wake needs in the caller's transaction: the job exists exactly when the wake does, once per fact. */
    enqueueDrain(payload: AgentTurnDrainPayload, source: string, eventKey: string, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENT_TURN_QUEUE, payload, {
            job: AgentTurnJob.Drain,
            dedupeKey: agentTurnWakeKey(payload.agentId, source, eventKey),
        })
    }

    /** Enqueues the drain a finished turn starts because its scope has more work due; one per finished turn. */
    enqueueNextDrain(payload: AgentTurnDrainPayload, turnId: string, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENT_TURN_QUEUE, payload, {
            job: AgentTurnJob.Drain,
            dedupeKey: agentTurnNextKey(payload.agentId, turnId),
        })
    }

    /** Enqueues the drain the minute sweep starts for a scope it found stuck; one per scope and minute. */
    enqueueSweepDrain(payload: AgentTurnDrainPayload, at: Date, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENT_TURN_QUEUE, payload, {
            job: AgentTurnJob.Drain,
            dedupeKey: agentTurnSweepKey(payload.agentId, payload.scopeKey, at),
        })
    }
}
