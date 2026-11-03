import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { ChatFileRead } from "../../chat-files.contracts"

@Entity({ schema: "public", name: "agent_message_attachments" })
/** One file that came with a message of a conversation or a line of the Office: a checked object in the private store. */
export class AgentMessageAttachmentEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The conversation; null for a line of the Office. */
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The message it came with: of the conversation, or a line of the Office. */
    @Column({ name: "message_id", type: "uuid" })
    messageId!: string

    /** The object path in the private bucket. */
    @Column({ name: "path", type: "text" })
    path!: string

    /** The name the sender gave it. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The type read from the stored bytes. */
    @Column({ name: "content_type", type: "text" })
    contentType!: string

    /** The stored size in bytes. */
    @Column({ name: "size_bytes", type: "integer" })
    sizeBytes!: number

    /** The address the channel gave for the file, or the local path of a manual import; null for a file a person uploaded. */
    @Column({ name: "source_url", type: "text", nullable: true })
    sourceUrl!: string | null

    /** The channel's own id of the message the file came with; null for a file a person uploaded. */
    @Column({ name: "source_ref", type: "text", nullable: true })
    sourceRef!: string | null

    /** What a turn read from the file, once; null before it was read. */
    @Column({ name: "read", type: "jsonb", nullable: true })
    read!: ChatFileRead | null
}
