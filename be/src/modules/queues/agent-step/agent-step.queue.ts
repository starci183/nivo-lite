import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AGENT_STEP_QUEUE, AgentStepJob, agentStepKey, agentStepSweepKey } from "./agent-step.contracts"
import type { AgentStepPayload } from "./agent-step.contracts"

@Injectable()
/** The typed producer of the agent-step queue: the one way an advance job starts. */
export class AgentStepQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the advance a committed step needs in the caller's transaction: the job exists exactly when the commit does, once per mark. */
    enqueueAdvance(payload: AgentStepPayload, stepKey: string, mark: string, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENT_STEP_QUEUE, payload, {
            job: AgentStepJob.Advance,
            dedupeKey: agentStepKey(payload.runId, stepKey, mark),
        })
    }

    /** Enqueues the advance the minute sweep starts for a run it found stuck; one per run and minute. */
    enqueueSweepAdvance(payload: AgentStepPayload, at: Date, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENT_STEP_QUEUE, payload, {
            job: AgentStepJob.Advance,
            dedupeKey: agentStepSweepKey(payload.runId, at),
        })
    }
}
