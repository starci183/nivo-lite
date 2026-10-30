import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import { idAsNumber } from "./id-number-column.mapper"

/** The lifecycle states of an outbox row. */
export type JobOutboxState = "queued" | "running" | "done" | "failed"

@Entity({ schema: "public", name: "job_outbox" })
/** One legacy queue delivery row of public.job_outbox; the queue functions own its writes, tests and operators read it. */
export class JobOutboxEntity extends UuidAbstractEntity {
    /** The workspace the delivery belongs to; null for a delivery no workspace owns. */
    @Column({ name: "workspace_id", type: "uuid", nullable: true })
    workspaceId!: string | null

    /** The queue. */
    @Column({ name: "queue", type: "text" })
    queue!: string

    /** The job name inside the queue. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The payload the producer wrote. */
    @Column({ name: "payload", type: "jsonb", default: () => "'{}'::jsonb" })
    payload!: object

    /** The idempotency key, unique per delivery. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** When the relay sent it to the broker. */
    @Column({ name: "sent_at", type: "timestamptz", nullable: true })
    sentAt!: Date | null

    /** How many times a worker started it. */
    @Column({ name: "attempts", type: "integer", default: () => "0" })
    attempts!: number

    /** The last recorded failure. */
    @Column({ name: "last_error", type: "text", nullable: true })
    lastError!: string | null

    /** The message id of the pgmq era. */
    @Column({ name: "msg_id", type: "bigint", nullable: true, transformer: idAsNumber })
    msgId!: number | null

    /** Where the delivery stands. */
    @Column({ name: "state", type: "text", default: () => "'queued'::text" })
    state!: JobOutboxState

    /** When a worker first started it. */
    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null

    /** When it reached a terminal state. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null

    /** Until when the running worker's admission holds. */
    @Column({ name: "run_lease_until", type: "timestamptz", nullable: true })
    runLeaseUntil!: Date | null

    /** The worker admission token. */
    @Column({ name: "run_token", type: "uuid", nullable: true })
    runToken!: string | null

    /** Until when a relay holds the row. */
    @Column({ name: "relay_lease_until", type: "timestamptz", nullable: true })
    relayLeaseUntil!: Date | null

    /** The token fencing marks and resets against another relay's later claim. */
    @Column({ name: "lease_token", type: "uuid", nullable: true })
    leaseToken!: string | null

    /** When an operator asked for a fresh retry budget. */
    @Column({ name: "retry_requested_at", type: "timestamptz", nullable: true })
    retryRequestedAt!: Date | null

    /** When the reconciler looks at the row next. */
    @Column({ name: "reconcile_at", type: "timestamptz", default: () => "now()" })
    reconcileAt!: Date

    /** How many reconcile passes saw it. */
    @Column({ name: "reconcile_checks", type: "integer", default: () => "0" })
    reconcileChecks!: number
}
