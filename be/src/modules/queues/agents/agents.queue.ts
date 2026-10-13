import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AGENTS_QUEUE, AgentsJob, agentsDedupeKey, syncSubjectOf } from "./agents.contracts"
import type { GenerateWithAgentPayload, SetupTurnPayload, SyncAgentsPayload } from "./agents.contracts"

@Injectable()
/** The typed producer of the agents queue: the one way a sync or a generation job starts from the back end. */
export class AgentsQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the sync of an installation or a workspace in the caller's transaction; requests of the same minute are one job. */
    enqueueSyncAgents(payload: SyncAgentsPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENTS_QUEUE, payload, {
            job: AgentsJob.Sync,
            dedupeKey: agentsDedupeKey(AgentsJob.Sync, syncSubjectOf(payload), payload.requestedAt),
        })
    }

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
