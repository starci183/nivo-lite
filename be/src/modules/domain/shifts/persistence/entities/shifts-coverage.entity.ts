import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "shifts_coverage" })
/** How many people a position needs in a block of a weekday. */
export class ShiftsCoverageEntity {
    /** The block id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The weekday. */
    @Column({ name: "weekday", type: "smallint" })
    weekday!: number

    /** When the block starts. */
    @Column({ name: "start_time", type: "time" })
    startTime!: string

    /** When the block ends. */
    @Column({ name: "end_time", type: "time" })
    endTime!: string

    /** The position it covers. */
    @Column({ name: "position_id", type: "uuid" })
    positionId!: string

    /** The fewest people. */
    @Column({ name: "min_staff", type: "int", default: () => "1" })
    minStaff!: number

    /** The ideal number of people. */
    @Column({ name: "ideal_staff", type: "int", default: () => "1" })
    idealStaff!: number

    /** Whether it is a peak block. */
    @Column({ name: "is_peak", type: "boolean", default: () => "false" })
    isPeak!: boolean

    /** When it was made. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
