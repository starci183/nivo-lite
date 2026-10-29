import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "accounting_adjustments" })
/** An append-only correction attached to a workspace invoice or bank payment. */
export class AccountingAdjustmentEntity {
    /** The correction id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns the correction. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The kind of corrected record. */
    @Column({ name: "target_type", type: "text" })
    targetType!: "invoice" | "transaction"

    /** The corrected record id. */
    @Column({ name: "target_id", type: "uuid" })
    targetId!: string

    /** The human basis of the correction. */
    @Column({ name: "note", type: "text" })
    note!: string

    /** The recorded corrected amount in VND, or null for a note only. */
    @Column({ name: "corrected_amount_vnd", type: "bigint", nullable: true })
    correctedAmountVnd!: string | null

    /** The member name when this correction was recorded. */
    @Column({ name: "created_by", type: "text" })
    createdBy!: string

    /** The authenticated database user that appended the correction, when there is one. */
    @Column({ name: "created_by_user", type: "uuid", nullable: true, default: () => "auth.uid()" })
    createdByUser!: string | null

    /** The append time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
