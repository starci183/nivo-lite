import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "booking_exceptions" })
/** A closing or special opening on a calendar date. */
export class BookingExceptionEntity {
    /** The exception id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The resource, or null for every resource. */
    @Column({ name: "resource_id", type: "uuid", nullable: true })
    resourceId!: string | null

    /** The calendar date, YYYY-MM-DD. */
    @Column({ name: "on_date", type: "date" })
    onDate!: string

    /** Whether the date is closed. */
    @Column({ name: "closed", type: "boolean", default: () => "true" })
    closed!: boolean

    /** The special opening time. */
    @Column({ name: "start_time", type: "time", nullable: true })
    startTime!: string | null

    /** The special closing time. */
    @Column({ name: "end_time", type: "time", nullable: true })
    endTime!: string | null

    /** The operator note. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string
}
