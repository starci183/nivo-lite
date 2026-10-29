import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "shifts_notifications" })
/** One message of the shifts module kept as evidence, sent, failed or skipped. */
export class ShiftsNotificationEntity {
    /** The notice id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The person it went to, or null. */
    @Column({ name: "staff_id", type: "uuid", nullable: true })
    staffId!: string | null

    /** The schedule it is about, or null. */
    @Column({ name: "schedule_id", type: "uuid", nullable: true })
    scheduleId!: string | null

    /** The shift it is about, or null. */
    @Column({ name: "shift_id", type: "uuid", nullable: true })
    shiftId!: string | null

    /** What it was (reminder, no_show, publish, payroll, ...). */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The channel it used. */
    @Column({ name: "channel", type: "text" })
    channel!: string

    /** sent, failed or skipped. */
    @Column({ name: "status", type: "text", default: () => "'sent'::text" })
    status!: string

    /** The text. */
    @Column({ name: "body", type: "text", default: () => "''::text" })
    body!: string

    /** Why it failed, or null. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** When it was written. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
