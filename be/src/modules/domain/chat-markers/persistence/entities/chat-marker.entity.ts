import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "chat_markers" })
/** One row of public.chat_markers: what one member has received, read and muted in one chat target. */
export class ChatMarkerEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The member. */
    @PrimaryColumn({ name: "user_id", type: "uuid" })
    userId!: string

    /** The target key: the conversation id, else the room. A database column derived from the two. */
    @PrimaryColumn({ name: "target_key", type: "text", insert: false, update: false })
    targetKey!: string

    /** The office room of the target; empty for the office and for a conversation. */
    @Column({ name: "room", type: "text", default: () => "''::text" })
    room!: string

    /** The customer conversation of the target; null for a room. */
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** When the newest delivered message was created. */
    @Column({ name: "delivered_at", type: "timestamptz", nullable: true })
    deliveredAt!: Date | null

    /** The newest delivered message. */
    @Column({ name: "delivered_message_id", type: "uuid", nullable: true })
    deliveredMessageId!: string | null

    /** When the newest read message was created. */
    @Column({ name: "read_at", type: "timestamptz", nullable: true })
    readAt!: Date | null

    /** The newest read message. */
    @Column({ name: "read_message_id", type: "uuid", nullable: true })
    readMessageId!: string | null

    /** Whether the member muted the target. */
    @Column({ name: "muted", type: "boolean", default: () => "false" })
    muted!: boolean
}
