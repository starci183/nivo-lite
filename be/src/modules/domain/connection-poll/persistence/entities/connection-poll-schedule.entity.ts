import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "@modules/platform/database"
import type { UnavailableReason } from "../../connection-poll.contracts"
import type { BreakerState } from "../../poll-schedule.contracts"

@Entity({ schema: "public", name: "connection_poll_schedule" })
/** The poll plan of one connection: when it is read next, at which interval, and how its circuit breaker stands. */
export class ConnectionPollScheduleEntity extends AbstractEntity {
    /** The connection. */
    @PrimaryColumn({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The workspace of the connection. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The provider of the connection. */
    @Column({ name: "provider", type: "text" })
    provider!: string

    /** When the connection is read next. */
    @Column({ name: "next_poll_at", type: "timestamptz", default: () => "now()" })
    nextPollAt!: Date

    /** The interval the connection was last planned with, in milliseconds. */
    @Column({ name: "interval_ms", type: "integer" })
    intervalMs!: number

    /** Consecutive failed polls. */
    @Column({ name: "failures", type: "integer", default: 0 })
    failures!: number

    /** The circuit breaker of the connection. */
    @Column({ name: "breaker_state", type: "text", default: "closed" })
    breakerState!: BreakerState

    /** When the breaker last opened. */
    @Column({ name: "breaker_opened_at", type: "timestamptz", nullable: true })
    breakerOpenedAt!: Date | null

    /** The provider refused the credential: nothing is polled until the owner connects again. */
    @Column({ name: "needs_reauth", type: "boolean", default: false })
    needsReauth!: boolean

    /** Polled fast until this instant. */
    @Column({ name: "hot_until", type: "timestamptz", nullable: true })
    hotUntil!: Date | null

    /** Why the connection is hot. */
    @Column({ name: "hot_reason", type: "text", nullable: true })
    hotReason!: string | null

    /** The last poll that ended well. */
    @Column({ name: "last_success_at", type: "timestamptz", nullable: true })
    lastSuccessAt!: Date | null

    /** The last delivery the webhook made for this connection. */
    @Column({ name: "last_webhook_at", type: "timestamptz", nullable: true })
    lastWebhookAt!: Date | null

    /** Why the provider cannot be read for this connection (its plan lacks the capability). */
    @Column({ name: "unavailable_reason", type: "text", nullable: true })
    unavailableReason!: UnavailableReason | null

    /** Where an unfinished backfill resumes. */
    @Column({ name: "backfill_to", type: "timestamptz", nullable: true })
    backfillTo!: Date | null

    /** The newest instant the unfinished backfill read. */
    @Column({ name: "backfill_newest", type: "timestamptz", nullable: true })
    backfillNewest!: Date | null
}
