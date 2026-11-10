import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AGENTS_QUEUE, AgentsJob, agentsDedupeKey } from "./agents.contracts"
import type { GenerateWithAgentPayload, SetupTurnPayload } from "./agents.contracts"

@Injectable()
/** The typed producer of the agents queue: the one way a generation or a setup-turn job starts from the back end. */
export class AgentsQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the run of a queued generation in the caller's transaction: the job exists exactly when the ai_generations row does. */
    enqueueGenerate(payload: GenerateWithAgentPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENTS_QUEUE, payload, {
            job: AgentsJob.Generate,
            dedupeKey: agentsDedupeKey(AgentsJob.Generate, payload.generationId),
        })
    }

    /** Enqueues the answer to an owner message of the setup chat in the caller's transaction: one job per message. */
    enqueueSetupTurn(payload: SetupTurnPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENTS_QUEUE, payload, {
            job: AgentsJob.SetupTurn,
            dedupeKey: agentsDedupeKey(AgentsJob.SetupTurn, payload.messageId),
        })
    }
}
