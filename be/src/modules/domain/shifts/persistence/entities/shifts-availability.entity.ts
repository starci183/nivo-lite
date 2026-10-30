import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "shifts_availability" })
/** A statement of when a person can or cannot work. */
export class ShiftsAvailabilityEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The shifts profile. */
    @Column({ name: "staff_id", type: "uuid" })
    staffId!: string

    /** The weekday it repeats on, or null for a single date. */
    @Column({ name: "weekday", type: "smallint", nullable: true })
    weekday!: number | null

    /** The single date, or null for a weekday. */
    @Column({ name: "shift_date", type: "date", nullable: true })
    shiftDate!: string | null

    /** From when. */
    @Column({ name: "start_time", type: "time", default: () => "'00:00:00'::time without time zone" })
    startTime!: string

    /** Until when. */
    @Column({ name: "end_time", type: "time", default: () => "'23:59:00'::time without time zone" })
    endTime!: string

    /** Whether the person is available in that window. */
    @Column({ name: "available", type: "boolean", default: () => "true" })
    available!: boolean

    /** A note. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** pending, approved or rejected. */
    @Column({ name: "status", type: "text", default: () => "'approved'::text" })
    status!: string

    /** Who decided it, or null. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null
}
