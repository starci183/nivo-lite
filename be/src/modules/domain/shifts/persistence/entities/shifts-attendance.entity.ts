import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "shifts_attendance" })
/** The check-in of a person for a shift. */
export class ShiftsAttendanceEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The shift. */
    @Column({ name: "shift_id", type: "uuid" })
    shiftId!: string

    /** The person who checked in. */
    @Column({ name: "staff_id", type: "uuid" })
    staffId!: string

    /** When they checked in. */
    @Column({ name: "checked_in_at", type: "timestamptz", default: () => "now()" })
    checkedInAt!: Date
}
