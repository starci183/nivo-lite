import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "ai_quota_overrides" })
/** The AI allowances of one workspace that differ from its plan. */
export class AiQuotaOverrideEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The own monthly message allowance. */
    @Column({ name: "messages_limit", type: "integer", nullable: true })
    messagesLimit!: number | null

    /** The own monthly token allowance. */
    @Column({ name: "tokens_limit", type: "bigint", nullable: true })
    tokensLimit!: string | null

    /** The reply given when the allowance is spent. */
    @Column({ name: "fallback_reply", type: "text", nullable: true })
    fallbackReply!: string | null

    /** The operator note. */
    @Column({ name: "note", type: "text", nullable: true })
    note!: string | null

    /** When the override last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date

    /** The own monthly credit allowance; null means the plan applies. */
    @Column({ name: "credits_limit", type: "bigint", nullable: true })
    creditsLimit!: string | null
}
