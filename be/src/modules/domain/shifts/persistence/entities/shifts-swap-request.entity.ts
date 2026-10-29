import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "shifts_swap_requests" })
/** A request to swap or claim a shift. */
export class ShiftsSwapRequestEntity {
    /** The request id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** swap or claim. */
    @Column({ name: "kind", type: "text", default: () => "'swap'::text" })
    kind!: string

    /** The shift. */
    @Column({ name: "shift_id", type: "uuid" })
    shiftId!: string

    /** Who offers it, or null for an open shift. */
    @Column({ name: "from_staff_id", type: "uuid", nullable: true })
    fromStaffId!: string | null

    /** Who takes it. */
    @Column({ name: "to_staff_id", type: "uuid" })
    toStaffId!: string

    /** The reason. */
    @Column({ name: "reason", type: "text", default: () => "''::text" })
    reason!: string

    /** pending, approved or rejected. */
    @Column({ name: "status", type: "text", default: () => "'pending'::text" })
    status!: string

    /** The findings of the rule checks. */
    @Column({ name: "checks", type: "jsonb", default: () => "'[]'::jsonb" })
    checks!: unknown

    /** The decision about it, or null. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** Who decided it, or null. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** When it was decided, or null. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null

    /** When it was asked. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
