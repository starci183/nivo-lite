import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectConnectionPollOptions } from "./connection-poll.decorators"
import { ConnectionPollScheduleEntity } from "./persistence/entities"
import type { PollPlan } from "./poll-schedule.policy"
import type { ConnectionPollOptions, PollHotReason, PollScheduleRow } from "./poll-schedule.contracts"

/** A connection that is due, with the instant it was due at (the scheduler's lag is how far past that the poll starts). */
export interface DueConnection {
    /** The schedule row as it was claimed. */
    readonly row: PollScheduleRow
    /** When the poll was planned for. */
    readonly dueAt: Date
}

const rowOf = (entity: ConnectionPollScheduleEntity): PollScheduleRow => ({
    connectionId: entity.connectionId,
    workspaceId: entity.workspaceId,
    provider: entity.provider,
    intervalMs: entity.intervalMs,
    failures: entity.failures,
    breakerState: entity.breakerState,
    breakerOpenedAt: entity.breakerOpenedAt,
    needsReauth: entity.needsReauth,
    hotUntil: entity.hotUntil,
    unavailableReason: entity.unavailableReason,
    lastSuccessAt: entity.lastSuccessAt,
    lastWebhookAt: entity.lastWebhookAt,
    backfillTo: entity.backfillTo,
    backfillNewest: entity.backfillNewest,
})

/** Puts a connection in the schedule, hot, or makes an existing row hot and due sooner; a row that needs the owner stays parked. */
export const MARK_HOT_SQL = `
INSERT INTO public.connection_poll_schedule (connection_id, workspace_id, provider, next_poll_at, interval_ms, hot_until, hot_reason)
SELECT c.id, c.workspace_id, c.provider, now(), $2::integer, now() + make_interval(secs => $3::double precision / 1000), $4
FROM public.connections c
WHERE c.id = $1 AND c.status <> 'disconnected'
ON CONFLICT (connection_id) DO UPDATE SET
    hot_until = GREATEST(connection_poll_schedule.hot_until, EXCLUDED.hot_until),
    hot_reason = EXCLUDED.hot_reason,
    next_poll_at = CASE
        WHEN connection_poll_schedule.needs_reauth THEN connection_poll_schedule.next_poll_at
        ELSE LEAST(connection_poll_schedule.next_poll_at, now() + make_interval(secs => $2::double precision / 1000))
    END
`

/** Puts every connection of the given providers that has no row into the schedule, spread at random over the healthy interval so tenants never poll in step. */
export const ENROLL_SQL = `
INSERT INTO public.connection_poll_schedule (connection_id, workspace_id, provider, next_poll_at, interval_ms)
SELECT c.id, c.workspace_id, c.provider, now() + make_interval(secs => random() * $2::double precision / 1000), $2::integer
FROM public.connections c
WHERE c.provider = ANY($1) AND c.status <> 'disconnected'
ON CONFLICT (connection_id) DO NOTHING
`

@Injectable()
/**
 * The only writer of public.connection_poll_schedule: which connections are due, what each poll planned next, and the signals other modules give
 * (a connection that became ready or has demand is hot; the webhook delivered). Claiming uses FOR UPDATE SKIP LOCKED, so replicas never take the same
 * connection, and a lease frees a connection whose worker died.
 */
export class PollScheduleService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectConnectionPollOptions() private readonly options: ConnectionPollOptions,
    ) {}

    /** Gives every connection of the providers a row in the schedule. */
    async enroll(providers: ReadonlyArray<string>): Promise<void> {
        await this.entityManager.query(ENROLL_SQL, [[...providers], this.options.schedule.healthyIntervalMs])
    }

    /** Claims up to `size` due connections of the providers, oldest first, and holds them for the lease. */
    claimDue(providers: ReadonlyArray<string>, size: number): Promise<ReadonlyArray<DueConnection>> {
        return this.entityManager.transaction(async (tx) => {
            const due = await tx
                .createQueryBuilder(ConnectionPollScheduleEntity, "s")
                .where("s.provider IN (:...providers) AND s.needs_reauth = false AND s.next_poll_at <= now()", {
                    providers: [...providers],
                })
                .orderBy("s.next_poll_at")
                .limit(size)
                .setLock("pessimistic_write")
                .setOnLocked("skip_locked")
                .getMany()
            if (due.length === 0) return []
            await tx.update(
                ConnectionPollScheduleEntity,
                { connectionId: In(due.map((entity) => entity.connectionId)) },
                { nextPollAt: () => `now() + make_interval(secs => ${this.options.schedule.leaseMs / 1000})` },
            )
            return due.map((entity) => ({ row: rowOf(entity), dueAt: entity.nextPollAt }))
        })
    }

    /** Writes what a finished poll planned. */
    async settle(connectionId: string, plan: PollPlan): Promise<void> {
        await this.entityManager.update(
            ConnectionPollScheduleEntity,
            { connectionId },
            {
                nextPollAt: new Date(plan.nextPollAt),
                intervalMs: plan.intervalMs,
                failures: plan.failures,
                breakerState: plan.breakerState,
                breakerOpenedAt: plan.breakerOpenedAt === null ? null : new Date(plan.breakerOpenedAt),
                needsReauth: plan.needsReauth,
                unavailableReason: plan.unavailableReason,
                backfillTo: plan.backfillTo === null ? null : new Date(plan.backfillTo),
                backfillNewest: plan.backfillNewest === null ? null : new Date(plan.backfillNewest),
                ...(plan.succeeded ? { lastSuccessAt: () => "now()" } : {}),
            },
        )
    }

    /** Plans the connection again at `nextPollAt` without counting a poll. */
    async defer(connectionId: string, nextPollAt: Date): Promise<void> {
        await this.entityManager.update(ConnectionPollScheduleEntity, { connectionId }, { nextPollAt })
    }

    /**
     * Makes the connection hot: it is polled at the hot interval until the time to live runs out, and its next poll is brought forward. Other modules
     * call this when a connection has demand (an order awaiting payment, an open payment claim). A connection that is not in the schedule yet joins it.
     */
    async markHot(connectionId: string, reason: PollHotReason, ttlMs: number = this.options.schedule.hotTtlMs): Promise<void> {
        await this.entityManager.query(MARK_HOT_SQL, [connectionId, this.options.schedule.hotIntervalMs, ttlMs, reason])
    }

    /**
     * The connection can be read back now (its credential was just saved, or the owner says the provider plan was upgraded): the breaker, the owner
     * request and the unavailable capability are cleared and it is polled hot.
     */
    async markReady(connectionId: string): Promise<void> {
        await this.entityManager.update(
            ConnectionPollScheduleEntity,
            { connectionId },
            { failures: 0, breakerState: "closed", breakerOpenedAt: null, needsReauth: false, unavailableReason: null },
        )
        await this.markHot(connectionId, "connection_ready")
    }

    /** The webhook of the provider delivered for this connection: it is healthy, so the interval may be long. */
    async recordWebhook(connectionId: string): Promise<void> {
        await this.entityManager.update(ConnectionPollScheduleEntity, { connectionId }, { lastWebhookAt: () => "now()" })
    }
}
