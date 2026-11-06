import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

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
    authorKind!: string

    /** The account or the agent; null for a system line. */
    @Column({ name: "author_id", type: "uuid", nullable: true })
    authorId!: string | null

    /** The text. */
    @Column({ type: "text", default: () => "''" })
    body!: string

    /** `text`, `report`, `approval` or `system`. */
    @Column({ type: "text", default: () => "'text'" })
    kind!: string

    /** The one engine object a report (`run_id`) or an approval (`decision_id`) is about. */
    @Column({ type: "jsonb", nullable: true })
    ref!: Readonly<Record<string, string>> | null

    /** Who the author mentioned: `{kind, id}` entries. */
    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    mentions!: ReadonlyArray<Readonly<Record<string, string>>>

    /** The files sent with the message. */
    @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
    attachments!: ReadonlyArray<Readonly<Record<string, string | number>>>

    /** The author's retry key. */
    @Column({ name: "client_id", type: "text", nullable: true })
    clientId!: string | null

    /** When the message was edited; null when it never was. */
    @Column({ name: "edited_at", type: "timestamptz", nullable: true })
    editedAt!: Date | null
}
