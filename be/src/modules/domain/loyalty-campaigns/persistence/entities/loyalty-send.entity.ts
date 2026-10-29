import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** Where one promotion send stands. */
export type LoyaltySendStatus = "queued" | "sent" | "failed" | "skipped"

@Entity({ schema: "public", name: "loyalty_sends" })
/** One promotion message to one customer of a campaign. */
export class LoyaltySendEntity {
    /** The send. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns it. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The campaign it belongs to. */
    @Column({ name: "campaign_id", type: "uuid" })
    campaignId!: string

    /** The customer it goes to. */
    @Column({ name: "customer_id", type: "uuid" })
    customerId!: string

    /** The lead of the customer, when there is one. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The conversation the message was delivered in. */
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The delivery status. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: LoyaltySendStatus

    /** The message text. */
    @Column({ name: "body", type: "text", nullable: true })
    body!: string | null

    /** Why it failed, when it did. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** When it went out. */
    @Column({ name: "sent_at", type: "timestamptz", nullable: true })
    sentAt!: Date | null

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
