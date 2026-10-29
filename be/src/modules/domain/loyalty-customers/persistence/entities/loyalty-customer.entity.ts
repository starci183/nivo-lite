import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "loyalty_customers" })
/** One person of a workspace's loyalty programme. */
export class LoyaltyCustomerEntity {
    /** The customer. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns the customer. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The name shown to the owner. */
    @Column({ name: "name", type: "text", default: () => "''::text" })
    name!: string

    /** The normalised phone, unique within the workspace when set. */
    @Column({ name: "phone", type: "text", nullable: true })
    phone!: string | null

    /** The lower-case email, unique within the workspace when set. */
    @Column({ name: "email", type: "text", nullable: true })
    email!: string | null

    /** The birthday as `YYYY-MM-DD` text. */
    @Column({ name: "birthday", type: "date", nullable: true })
    birthday!: string | null

    /** The key of the held tier, when the customer holds one. */
    @Column({ name: "tier_key", type: "text", nullable: true })
    tierKey!: string | null

    /** When the customer reached the held tier. */
    @Column({ name: "tier_since", type: "timestamptz", nullable: true })
    tierSince!: Date | null

    /** When the customer joined. */
    @Column({ name: "joined_at", type: "timestamptz", default: () => "now()" })
    joinedAt!: Date

    /** The note of the owner. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** The last change. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
