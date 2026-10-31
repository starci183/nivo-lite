import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "job_slots" })
/** One running slot of a workspace in public.job_slots: the lease that keeps a workspace within its concurrent-job limit across every replica. The queue functions claim and release it. */
export class JobSlotEntity extends AbstractEntity {
    /** The queue of the running job. */
    @PrimaryColumn({ name: "queue", type: "text" })
    queue!: string

    /** The outbox row id of the running job. */
    @PrimaryColumn({ name: "job_id", type: "uuid" })
    jobId!: string

    /** The workspace the slot is counted against. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** Until when the slot is held; a lapsed lease frees it. */
    @Column({ name: "lease_until", type: "timestamptz" })
    leaseUntil!: Date
}
