import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "hiring_retention_log" })
/** One run of the retention sweep of a workspace. */
export class HiringRetentionLogEntity extends UuidAbstractEntity {
    /** The workspace the run belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** How many candidates were deleted. */
    @Column({ name: "deleted_candidates", type: "integer", default: () => "0" })
    deletedCandidates!: number

    /** How many CV files were deleted. */
    @Column({ name: "deleted_files", type: "integer", default: () => "0" })
    deletedFiles!: number

    /** The retention period the run used, in days. */
    @Column({ name: "retention_days", type: "integer" })
    retentionDays!: number

    /** When the run happened. */
    @Column({ name: "ran_at", type: "timestamptz", default: () => "now()" })
    ranAt!: Date
}
