import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "shifts_settings" })
/** The shifts rules of one workspace. */
export class ShiftsSettingsEntity extends AbstractEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The opening hours by weekday. */
    @Column({ name: "opening_hours", type: "jsonb", default: () => "'{}'::jsonb" })
    openingHours!: object

    /** The notice a swap needs, in hours. */
    @Column({ name: "swap_notice_hours", type: "int", default: () => "24" })
    swapNoticeHours!: number

    /** The notice a leave needs, in days. */
    @Column({ name: "leave_notice_days", type: "int", default: () => "2" })
    leaveNoticeDays!: number

    /** How long before a shift the reminder goes. */
    @Column({ name: "remind_minutes", type: "int", default: () => "60" })
    remindMinutes!: number

    /** How late a person is a no-show. */
    @Column({ name: "noshow_minutes", type: "int", default: () => "10" })
    noshowMinutes!: number

    /** The hours a week after which pay is overtime (numeric, so text). */
    @Column({ name: "overtime_hours_week", type: "numeric", default: () => "48" })
    overtimeHoursWeek!: string
}
