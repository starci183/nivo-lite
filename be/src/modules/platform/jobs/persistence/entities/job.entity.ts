import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import { tokenAsNumber } from "./fencing-token-column.mapper"

/** The lifecycle states of a job row. */
export type JobState = "running" | "done" | "failed"

@Entity({ schema: "public", name: "jobs" })
/** One delivery of a queue job: the claim, its lease and the fencing token that rejects a zombie worker. */
export class JobEntity extends UuidAbstractEntity {
    /** The kind of the job. */
    @Column({ name: "kind", type: "varchar" })
    kind!: string

    /** The delivery key, unique per job. */
    @Column({ name: "job_key", type: "varchar" })
    jobKey!: string

    /** Running, done or failed. */
    @Column({ name: "status", type: "varchar" })
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
}
