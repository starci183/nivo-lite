import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** How a supplier receives orders. */
export type SupplierChannel = "email" | "zalo" | "phone"

@Entity({ schema: "public", name: "inventory_suppliers" })
/** One supplier a workspace buys from. */
export class InventorySupplierEntity {
    /** The supplier. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns the supplier. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The supplier name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The contact person. */
    @Column({ name: "contact_name", type: "text", default: () => "''::text" })
    contactName!: string

    /** The contact email. */
    @Column({ name: "email", type: "text", nullable: true })
    email!: string | null

    /** The contact phone. */
    @Column({ name: "phone", type: "text", nullable: true })
    phone!: string | null

    /** The contact Zalo. */
    @Column({ name: "zalo", type: "text", nullable: true })
    zalo!: string | null

    /** How orders are sent: email, zalo or phone. */
    @Column({ name: "channel", type: "text", default: () => "'email'::text" })
    channel!: SupplierChannel

    /** The days an order takes to arrive. */
    @Column({ name: "lead_time_days", type: "integer", default: () => "2" })
    leadTimeDays!: number

    /** The payment terms. */
    @Column({ name: "payment_terms", type: "text", default: () => "''::text" })
    paymentTerms!: string

    /** The owner's note. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** Whether the supplier is in use. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
