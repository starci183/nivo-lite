import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** What a link ties a customer to: a lead, a conversation or a chat account. */
export type LoyaltyCustomerLinkKind = "lead" | "conversation" | "channel"

@Entity({ schema: "public", name: "loyalty_customer_links" })
/** One tie between a loyalty customer and something that identifies them elsewhere. */
export class LoyaltyCustomerLinkEntity {
    /** The link. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns the link. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The customer (an id of the loyalty-customers capability). */
    @Column({ name: "customer_id", type: "uuid" })
    customerId!: string

    /** What the reference points at. */
    @Column({ name: "kind", type: "text" })
    kind!: LoyaltyCustomerLinkKind

    /** The lead id, the conversation id or the `channel:account` text. */
    @Column({ name: "ref", type: "text" })
    ref!: string

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
