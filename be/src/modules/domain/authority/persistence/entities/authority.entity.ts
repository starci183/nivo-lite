import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "authority" })
/** The owner goals and house rules of one workspace. */
export class AuthorityEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The monthly revenue goal in VND. */
    @Column({ name: "goal_revenue_vnd", type: "bigint", nullable: true })
    goalRevenueVnd!: string | null

    /** The new-customer goal. */
    @Column({ name: "goal_new_customers", type: "integer", nullable: true })
    goalNewCustomers!: number | null

    /** The first-reply goal in minutes. */
    @Column({ name: "goal_first_reply_minutes", type: "integer", nullable: true })
    goalFirstReplyMinutes!: number | null

    /** Free note on the goals. */
    @Column({ name: "goal_note", type: "text", default: () => "''::text" })
    goalNote!: string

    /** The business policies. */
    @Column({ name: "policies", type: "text", default: () => "''::text" })
    policies!: string

    /** How replies are written. */
    @Column({ name: "reply_style", type: "text", default: () => "''::text" })
    replyStyle!: string

    /** The brand voice. */
    @Column({ name: "brand_voice", type: "text", default: () => "''::text" })
    brandVoice!: string

    /** What the agent must always ask about first. */
    @Column({ name: "limits_note", type: "text", default: () => "''::text" })
    limitsNote!: string

    /** When demo data was seeded. */
    @Column({ name: "demo_seeded_at", type: "timestamptz", nullable: true })
    demoSeededAt!: Date | null

    /** Who saved it last. */
    @Column({ name: "updated_by", type: "text", nullable: true })
    updatedBy!: string | null

    /** When it was saved last. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
