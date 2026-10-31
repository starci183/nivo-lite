import { Injectable } from "@nestjs/common"
import { In, IsNull, LessThan, Like } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import {
    CONVERSATION_SCOPE_PREFIX,
    IDLE_LEASE_RETENTION_MS,
    SKIPPED_WAKE_RETENTION_MS,
    WAKE_RETENTION_MS,
} from "./agent-work.policy"
import { AgentWakeEntity, AgentWorkLeaseEntity } from "./persistence/entities"
import type { AgentWakeStatus } from "./agent-work.contracts"

/** The endings a wake can be kept in once it is over; a pending or running wake is never removed. */
const ENDED: ReadonlyArray<AgentWakeStatus> = ["done", "held", "failed", "dead"]

@Injectable()
/**
 * Removes what is past retention, a bounded batch at a time: a skipped wake after 2 days, every other ended wake after 30 (their turns go with
 * them), and the lease row of a customer conversation that has been idle for 2 days. The agent's own lease row stays: there is one per agent.
 */
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
        const leases = await this.expireLeases(new Date(now - IDLE_LEASE_RETENTION_MS), batch)
        return skipped + ended + leases
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

    /** A conversation's lease row is made again by the next wake of that conversation, so an idle one is only dead weight. */
    private async expireLeases(before: Date, batch: number): Promise<number> {
        const rows = await this.entityManager.find(AgentWorkLeaseEntity, {
            select: { agentId: true, scopeKey: true },
            where: {
                scopeKey: Like(`${CONVERSATION_SCOPE_PREFIX}%`),
                runningTurnId: IsNull(),
                updatedAt: LessThan(before),
            },
            order: { updatedAt: "ASC" },
            take: batch,
        })
        if (rows.length === 0) return 0
        const removed = await Promise.all(
            rows.map(({ agentId, scopeKey }) => this.entityManager.delete(AgentWorkLeaseEntity, { agentId, scopeKey })),
        )
        return removed.reduce((sum, result) => sum + (result.affected ?? 0), 0)
    }
}
