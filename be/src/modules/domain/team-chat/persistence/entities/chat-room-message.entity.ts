import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { Attachment, AuthorKind, MessageKind, MessageRef, StoredMention } from "../../team-chat.contracts"

@Entity({ schema: "public", name: "chat_room_messages" })
/** One row of public.chat_room_messages: a text, a report of a run, an approval card of a decision, or a system line. */
export class ChatRoomMessageEntity extends UuidAbstractEntity {
    /** The room. */
    @Column({ name: "room_id", type: "uuid" })
    roomId!: string

    /** The workspace of the room. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** `user`, `agent` or `system`. */
    @Column({ name: "author_kind", type: "text" })
    authorKind!: AuthorKind

    /** The account or the agent; null for a system line. */
    @Column({ name: "author_id", type: "uuid", nullable: true })
    authorId!: string | null

    /** The text. */
    @Column({ type: "text", default: () => "''" })
    body!: string

    /** `text`, `report`, `approval` or `system`. */
    @Column({ type: "text", default: () => "'text'" })
    kind!: MessageKind

    /** The one engine object a report (`run_id`) or an approval (`decision_id`) is about. */
    @Column({ type: "jsonb", nullable: true })
    ref!: MessageRef | null

    /** Who the author mentioned: `{kind, id}` entries. */
    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    mentions!: ReadonlyArray<StoredMention>

    /** The files sent with the message. */
    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    attachments!: ReadonlyArray<Attachment>

    /** The author's retry key. */
    @Column({ name: "client_id", type: "text", nullable: true })
    clientId!: string | null

    /** The message of the same room this one answers; null when it answers none. */
    @Column({ name: "reply_to", type: "uuid", nullable: true })
    replyTo!: string | null

    /** When the message was edited; null when it never was. */
    @Column({ name: "edited_at", type: "timestamptz", nullable: true })
    editedAt!: Date | null
}
