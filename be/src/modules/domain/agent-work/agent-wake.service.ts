import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { isRecord } from "@modules/platform/primitives"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectAgentTurnQueue } from "@modules/queues/agent-turn"
import type { AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentWorkLogEvent } from "./agent-work.log-events"
import { wakeSources } from "./agent-wake-source.policy"
import { scopeKeyOf } from "./agent-work.policy"
import { AgentWakeEntity } from "./persistence/entities"
import type { AgentWake } from "./agent-work.contracts"
import type { OptionalWakeId } from "./agent-work-source.contracts"

/** The id of the row an insert returned, or null when it wrote none. */
const idOf = (raw: unknown): OptionalWakeId => {
    if (!Array.isArray(raw)) return null
    const rows: ReadonlyArray<unknown> = raw
    const [row] = rows
    if (!isRecord(row)) return null
    return typeof row.id === "string" ? row.id : null
}

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
        return (await this.write(tx, wake)) !== null
    }

    /** Writes the wake and its drain job in `tx` and answers the wake's id; null when the fact was already written, in which case nothing is enqueued. */
    async write(tx: EntityManager, wake: AgentWake): Promise<OptionalWakeId> {
        const traits = wakeSources.of(wake.source)
        const scopeKey = wake.scopeKey ?? scopeKeyOf(wake.source, wake.context)
        const inserted = await tx
            .createQueryBuilder(AgentWakeEntity, "w")
            .insert()
            .values({
                workspaceId: wake.workspaceId,
                agentId: wake.agentId,
                source: wake.source,
                eventKey: wake.eventKey,
                scopeKey,
                priority: traits.priority,
                maxAttempts: traits.maxAttempts,
                background: traits.background,
                context: wake.context,
                actorMemberId: wake.actorMemberId,
            })
            .orIgnore()
            .returning("id")
            .execute()
        const id = idOf(inserted.raw)
        if (id === null) return null
        await this.queue.enqueueDrain(
            { workspaceId: wake.workspaceId, agentId: wake.agentId, scopeKey },
            wake.source,
            wake.eventKey,
            tx,
        )
        this.logger.info(AgentWorkLogEvent.WakeWritten, { agentId: wake.agentId, source: wake.source, scopeKey })
        return id
    }
}
