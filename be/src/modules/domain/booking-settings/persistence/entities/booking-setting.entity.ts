import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "booking_settings" })
/** The booking policy and public page of one workspace. */
export class BookingSettingEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The time zone of the calendar. */
    @Column({ name: "timezone", type: "text", default: () => "'Asia/Ho_Chi_Minh'::text" })
    timezone!: string

    /** The slot step in minutes. */
    @Column({ name: "slot_step_min", type: "integer", default: () => "15" })
    slotStepMin!: number

    /** The shortest lead in minutes. */
    @Column({ name: "min_lead_min", type: "integer", default: () => "60" })
    minLeadMin!: number

    /** The furthest advance in days. */
    @Column({ name: "max_advance_days", type: "integer", default: () => "60" })
    maxAdvanceDays!: number

    /** The free-cancellation window in hours. */
    @Column({ name: "cancel_window_hours", type: "integer", default: () => "24" })
    cancelWindowHours!: number

    /** The deposit percent. */
    @Column({ name: "deposit_pct", type: "integer", default: () => "0" })
    depositPct!: number

    /** The late-cancel fee percent. */
    @Column({ name: "late_cancel_fee_pct", type: "integer", default: () => "0" })
    lateCancelFeePct!: number

    /** The no-show fee in VND. */
    @Column({ name: "no_show_fee_vnd", type: "bigint", default: () => "0" })
    noShowFeeVnd!: string

    /** Whether bookings confirm themselves. */
    @Column({ name: "auto_confirm", type: "boolean", default: () => "true" })
    autoConfirm!: boolean

    /** Whether a booking hands off to an order. */
    @Column({ name: "handoff_order", type: "boolean", default: () => "false" })
    handoffOrder!: boolean

    /** The hours before a booking that reminders go out. */
    @Column({ name: "reminder_hours", type: "integer", array: true, default: () => "'{24" })
    reminderHours!: Array<number>

    /** Whether the public page is on. */
    @Column({ name: "public_enabled", type: "boolean", default: () => "false" })
    publicEnabled!: boolean

    /** The public page slug. */
    @Column({ name: "public_slug", type: "text", nullable: true })
    publicSlug!: string | null

    /** The note shown on the public page. */
    @Column({ name: "public_note", type: "text", default: () => "''::text" })
    publicNote!: string

    /** The address of the shop. */
    @Column({ name: "address", type: "text", default: () => "''::text" })
    address!: string

    /** When the settings last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
