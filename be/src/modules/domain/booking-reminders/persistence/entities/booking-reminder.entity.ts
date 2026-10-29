import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "booking_reminders" })
/** One reminder of a booking, scheduled for one offset before it starts. */
export class BookingReminderEntity {
    /** The reminder id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The booking. */
    @Column({ name: "booking_id", type: "uuid" })
    bookingId!: string

    /** The offset kind, such as h24. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** When the reminder is due. */
    @Column({ name: "due_at", type: "timestamptz" })
    dueAt!: Date

    /** Where the reminder stands. */
    @Column({ name: "status", type: "text", default: () => "'scheduled'::text" })
    status!: "scheduled" | "waiting" | "sent" | "skipped" | "failed" | "cancelled"

    /** The work item that carried it. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** A sentence the owner can read. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** When it was sent. */
    @Column({ name: "sent_at", type: "timestamptz", nullable: true })
    sentAt!: Date | null

    /** When it was planned. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
