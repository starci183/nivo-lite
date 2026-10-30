import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "shifts_staff" })
/** A person who works shifts: the profile the rules and the schedule run against. */
export class ShiftsStaffEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The shop staff record it is linked to, or null. */
    @Column({ name: "staff_id", type: "uuid", nullable: true })
    staffId!: string | null

    /** The account it is linked to, or null. */
    @Column({ name: "user_id", type: "uuid", nullable: true })
    userId!: string | null

    /** The phone, or null. */
    @Column({ name: "phone", type: "text", nullable: true })
    phone!: string | null

    /** The Telegram chat, or null. */
    @Column({ name: "telegram_chat_id", type: "text", nullable: true })
    telegramChatId!: string | null

    /** The Zalo user, or null. */
    @Column({ name: "zalo_user_id", type: "text", nullable: true })
    zaloUserId!: string | null

    /** The positions the person can work. */
    @Column({ name: "position_ids", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    positionIds!: Array<string>

    /** The skills the person has. */
    @Column({ name: "skills", type: "text", array: true, default: () => "'{}'::text[]" })
    skills!: Array<string>

    /** The most hours a week (numeric, so text). */
    @Column({ name: "max_hours_week", type: "numeric", default: () => "48" })
    maxHoursWeek!: string

    /** The most hours a day (numeric, so text). */
    @Column({ name: "max_hours_day", type: "numeric", default: () => "10" })
    maxHoursDay!: string

    /** The least rest between two days (numeric, so text). */
    @Column({ name: "min_rest_hours", type: "numeric", default: () => "10" })
    minRestHours!: string

    /** Whether the person still works shifts. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean
}
