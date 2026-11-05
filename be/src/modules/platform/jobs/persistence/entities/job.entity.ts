import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import { tokenAsNumber } from "./fencing-token-column.mapper"

/** The lifecycle states of a job row; a job a retry cannot fix waits as `failed_awaiting_fix` until it is resumed. */
export type JobState = "running" | "done" | "failed" | "failed_awaiting_fix"

@Entity({ schema: "public", name: "jobs" })
/** One delivery of a queue job: the claim, its lease and the fencing token that rejects a zombie worker. */
export class JobEntity extends UuidAbstractEntity {
    /** The kind of the job. */
    @Column({ name: "kind", type: "varchar" })
    kind!: string

    /** The delivery key, unique per job. */
    @Column({ name: "job_key", type: "varchar" })
    jobKey!: string

    /** Running, done, failed or parked. */
    @Column({ name: "status", type: "varchar", length: 32 })
    status!: JobState

    /** The last recorded step. */
    @Column({ name: "current_step", type: "varchar", nullable: true })
    currentStep!: string | null

    /** The fencing token, bumped by the store at each re-claim. */
    @Column({ name: "fencing_token", type: "bigint", transformer: tokenAsNumber })
    fencingToken!: number

    /** The worker that holds the claim. */
    @Column({ name: "claimed_by", type: "varchar", nullable: true })
    claimedBy!: string | null

    /** When the live claim lapses. */
    @Column({ name: "lease_expires_at", type: "timestamptz", nullable: true })
    leaseExpiresAt!: Date | null

    /** The job payload. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: object

    /** Why the job failed. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** Why a parked job cannot run on its own: the class of its failure. */
    @Column({ name: "failure_class", type: "varchar", length: 16, nullable: true })
    failureClass!: string | null

    /** The queue the job is handed back to when it is resumed. */
    @Column({ name: "queue", type: "varchar", length: 200, nullable: true })
    queue!: string | null

    /** The build that ran the job when it parked; a different build resumes it. */
    @Column({ name: "parked_build", type: "varchar", length: 200, nullable: true })
    parkedBuild!: string | null

    /** When the job parked; null while it is not parked. */
    @Column({ name: "parked_at", type: "timestamptz", nullable: true })
    parkedAt!: Date | null

    /** When the one alert of the park was raised. */
    @Column({ name: "alerted_at", type: "timestamptz", nullable: true })
    alertedAt!: Date | null

    /** How many times the job was handed back to its queue. */
    @Column({ name: "resume_count", type: "integer", default: () => "0" })
    resumeCount!: number
}
