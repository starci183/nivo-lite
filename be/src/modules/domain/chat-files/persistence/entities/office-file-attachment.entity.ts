import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { ChatFileRead } from "../../chat-files.contracts"

@Entity({ schema: "public", name: "office_file_attachments" })
/** One file that came with a message of a line of the Office: a checked object in the private store. */
export class OfficeFileAttachmentEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The line of the Office it came with. */
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

    /** What a turn read from the file, once; null before it was read. */
    @Column({ name: "read", type: "jsonb", nullable: true })
    read!: ChatFileRead | null
}
