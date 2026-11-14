import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import {
    AGENT_TURN_QUEUE,
    AgentTurnJob,
    agentTurnNextKey,
    agentTurnSweepKey,
    agentTurnWakeKey,
    type AgentTurnDrainPayload,
} from "./agent-turn.contracts"

@Injectable()
/** The typed producer of the agent-turn queue: the one way a drain job starts. */
export class AgentTurnQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the drain a new wake needs in the caller's transaction: the job exists exactly when the wake does, once per fact. */
    enqueueDrain(
        payload: AgentTurnDrainPayload,
        source: string,
        eventKey: string,
        tx: EntityManager,
        delayMs?: number,
    ): Promise<void> {
        return this.outbox.write(tx, AGENT_TURN_QUEUE, payload, {
            job: AgentTurnJob.Drain,
            dedupeKey: agentTurnWakeKey(payload.agentId, source, eventKey),
            delayMs: delayMs ?? 0,
        })
    }

    /** Enqueues the drain a finished turn starts because its scope has more work due; one per finished turn. */
    enqueueNextDrain(payload: AgentTurnDrainPayload, turnId: string, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENT_TURN_QUEUE, payload, {
            job: AgentTurnJob.Drain,
            dedupeKey: agentTurnNextKey(payload.agentId, turnId),
        })
    }

    /**
     * Enqueues the drain of a wake that is PENDING AGAIN (a run handed its event back, or the run it waited behind let it go), in the
     * caller's transaction. The wake's first drain job already holds its fact's dedupe key (`agentTurnWakeKey`, unique for ever in the
     * outbox), so writing that key again writes NO job and the wake waited for the minute sweep (60 to 120 s, DEF-5): this job has a
     * fresh identity, one per call. A drain finds the scope busy or idle when another drain served it first: a spare job costs nothing.
     */
    enqueueAgainDrain(payload: AgentTurnDrainPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENT_TURN_QUEUE, payload, { job: AgentTurnJob.Drain })
    }

    /** Enqueues the drain the minute sweep starts for a scope it found stuck; one per scope and minute. */
    enqueueSweepDrain(payload: AgentTurnDrainPayload, at: Date, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENT_TURN_QUEUE, payload, {
            job: AgentTurnJob.Drain,
            dedupeKey: agentTurnSweepKey(payload.agentId, payload.scopeKey, at),
        })
    }
}
