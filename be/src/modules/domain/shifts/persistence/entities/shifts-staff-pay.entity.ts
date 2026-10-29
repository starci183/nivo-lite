import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "shifts_staff_pay" })
/** The hourly wage of one person; kept apart so only the cost rules read it. */
export class ShiftsStaffPayEntity {
    /** The shifts profile. */
    @PrimaryColumn({ name: "staff_id", type: "uuid" })
    staffId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The hourly wage in VND. */
    @Column({ name: "hourly_wage_vnd", type: "int", default: () => "0" })
    hourlyWageVnd!: number

    /** When it last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
