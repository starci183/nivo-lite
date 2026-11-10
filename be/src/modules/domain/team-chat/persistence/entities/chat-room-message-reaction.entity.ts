import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"
import type { MemberKind } from "../../team-chat.contracts"

@Entity({ schema: "public", name: "chat_room_message_reactions" })
/** One row of public.chat_room_message_reactions: how many times one member tapped one emoji on one message. */
export class ChatRoomMessageReactionEntity extends AbstractEntity {
    /** The message. */
    @PrimaryColumn({ name: "message_id", type: "uuid" })
    messageId!: string

    /** Whether the member is a person or an agent. */
    @PrimaryColumn({ name: "member_kind", type: "text" })
    memberKind!: MemberKind

    /** The account or the agent. */
    @PrimaryColumn({ name: "member_id", type: "uuid" })
    memberId!: string

    /** The emoji. */
    @PrimaryColumn({ type: "text" })
    emoji!: string

    /** The room of the message. */
    @Column({ name: "room_id", type: "uuid" })
    roomId!: string

    /** The workspace of the room. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** How many times the member tapped the emoji on the message. */
    @Column({ type: "integer" })
    count!: number
}
