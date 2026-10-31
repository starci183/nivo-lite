import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectAgentTurnQueue } from "@modules/queues/agent-turn"
import type { AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import { attemptBudgetOf, priorityOf, scopeKeyOf } from "./agent-work.policy"
import { AgentWakeEntity } from "./persistence/entities"
import type { AgentWake } from "./agent-work.contracts"

@Injectable()
/**
 * The one door a wake starts through. It runs in the caller's transaction (BE-PERSISTENCE-5): the wake and the job that drains it commit
 * together or not at all, and the same fact written twice is one wake and one job.
 */
export class AgentWakeService {
    constructor(
        @InjectAgentTurnQueue() private readonly queue: AgentTurnQueue,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes the wake and its drain job in `tx`; answers false when the fact was already written, in which case nothing is enqueued. */
    async wake(tx: EntityManager, wake: AgentWake): Promise<boolean> {
        const scopeKey = scopeKeyOf(wake.source, wake.context)
        const inserted = await tx
            .createQueryBuilder(AgentWakeEntity, "w")
            .insert()
            .values({
                workspaceId: wake.workspaceId,
                agentId: wake.agentId,
                source: wake.source,
                eventKey: wake.eventKey,
                scopeKey,
                priority: priorityOf(wake.source),
                maxAttempts: attemptBudgetOf(wake.source),
                context: wake.context,
                actorMemberId: wake.actorMemberId,
            })
            .orIgnore()
            .returning("id")
            .execute()
        if (!Array.isArray(inserted.raw) || inserted.raw.length === 0) return false
        await this.queue.enqueueDrain(
            { workspaceId: wake.workspaceId, agentId: wake.agentId, scopeKey },
            wake.source,
            wake.eventKey,
            tx,
        )
        this.logger.info(AgentWorkLogEvent.WakeWritten, { agentId: wake.agentId, source: wake.source, scopeKey })
        return true
    }
}
