import { Injectable } from "@nestjs/common"
import { In, LessThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { SKIPPED_WAKE_RETENTION_MS, WAKE_RETENTION_MS } from "./agent-work.policy"
import { AgentWakeEntity } from "./persistence/entities"
import type { AgentWakeStatus } from "./agent-work.contracts"

/** The endings a wake can be kept in once it is over; a pending or running wake is never removed. */
const ENDED: ReadonlyArray<AgentWakeStatus> = ["done", "held", "failed", "dead"]

@Injectable()
/** Removes the wakes past retention, a bounded batch at a time: a skipped wake after 2 days, every other ended one after 30. Their turns go with them. */
export class AgentWakeRetentionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Removes at most `batch` wakes of each kind and answers how many went. */
    async sweep(batch: number): Promise<number> {
        const now = this.clock.now().getTime()
        const skipped = await this.expire(["skipped"], new Date(now - SKIPPED_WAKE_RETENTION_MS), batch)
        const ended = await this.expire(ENDED, new Date(now - WAKE_RETENTION_MS), batch)
        return skipped + ended
    }

    private async expire(statuses: ReadonlyArray<AgentWakeStatus>, before: Date, batch: number): Promise<number> {
        const rows = await this.entityManager.find(AgentWakeEntity, {
            select: { id: true },
            where: { status: In([...statuses]), createdAt: LessThan(before) },
            order: { createdAt: "ASC" },
            take: batch,
        })
        if (rows.length === 0) return 0
        const removed = await this.entityManager.delete(AgentWakeEntity, { id: In(rows.map((row) => row.id)) })
        return removed.affected ?? 0
    }
}
