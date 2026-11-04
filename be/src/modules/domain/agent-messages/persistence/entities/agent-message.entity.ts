import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "agent_messages" })
/** One message of a conversation between a customer and an agent: what a person wrote, what the agent answered, or a workbench line. */
export class AgentMessageEntity extends UuidAbstractEntity {
    /**
     * When the message was said: the database sets it (`DEFAULT now()`), unless the insert names the time an imported, polled or
     * webhook message carried. Open to insert on this entity alone, so no other table takes a time from its caller; no update changes it.
     */
    @Column({ name: "created_at", type: "timestamptz", insert: true, update: false })
    declare createdAt: Date

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

    /** The channel's own id of the customer message this row stores; null for lines no channel brought in. One row per conversation and id. */
    @Column({ name: "channel_ref", type: "text", nullable: true })
    channelRef!: string | null
}
