import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "agent_messages" })
/** One message of a conversation between a customer and an agent: what a person wrote, what the agent answered, or a workbench line. */
export class AgentMessageEntity {
    /** The message id; an approved answer uses its work item id so retries reuse one message. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The conversation. */
    @Column({ name: "conversation_id", type: "uuid" })
    conversationId!: string

    /** Who said it: user, agent or system. */
    @Column({ name: "role", type: "text" })
    role!: string

    /** What was said. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** When it was stored. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** Whether an agent message was written by the model (ai) or a person (human). */
    @Column({ name: "author_kind", type: "text", nullable: true })
    authorKind!: string | null

    /** The name of the person who wrote a human reply. */
    @Column({ name: "author_name", type: "text", nullable: true })
    authorName!: string | null

    /** Sent or failed once a delivery was tried. */
    @Column({ name: "delivery_status", type: "text", nullable: true })
    deliveryStatus!: string | null

    /** Why a delivery failed. */
    @Column({ name: "delivery_error", type: "text", nullable: true })
    deliveryError!: string | null

    /** The customer message an agent reply answers; a message has at most one agent reply. */
    @Column({ name: "in_reply_to", type: "uuid", nullable: true })
    inReplyTo!: string | null

    /** The proven member who wrote the message. */
    @Column({ name: "author_user_id", type: "uuid", nullable: true })
    authorUserId!: string | null
}
