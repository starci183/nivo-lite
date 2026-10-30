import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "shifts_shifts" })
/** One shift of a schedule: a day, a window, a position and a person (or none). */
export class ShiftsShiftEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The schedule it belongs to. */
    @Column({ name: "schedule_id", type: "uuid" })
    scheduleId!: string

    /** The day. */
    @Column({ name: "shift_date", type: "date" })
    shiftDate!: string

    /** When it starts. */
    @Column({ name: "start_time", type: "time" })
    startTime!: string

    /** When it ends. */
    @Column({ name: "end_time", type: "time" })
    endTime!: string

    /** The position. */
    @Column({ name: "position_id", type: "uuid" })
    positionId!: string

    /** Who works it, or null while open. */
    @Column({ name: "staff_id", type: "uuid", nullable: true })
    staffId!: string | null

    /** draft, published, swapped or cancelled. */
    @Column({ name: "status", type: "text", default: () => "'draft'::text" })
    status!: string

    /** Where it came from. */
    @Column({ name: "source", type: "text", default: () => "'solver'::text" })
    source!: string

    /** A note. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string
}
