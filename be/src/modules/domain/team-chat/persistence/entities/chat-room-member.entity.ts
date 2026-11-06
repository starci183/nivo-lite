import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "chat_room_members" })
/** One row of public.chat_room_members: a user or an agent in a room, with where they last read and whether they muted it. */
export class ChatRoomMemberEntity extends AbstractEntity {
    /** The room. */
    @PrimaryColumn({ name: "room_id", type: "uuid" })
    roomId!: string

    /** `user` or `agent`. */
    @PrimaryColumn({ name: "member_kind", type: "text" })
    memberKind!: string

    /** The account id of a user or the agent id. */
    @PrimaryColumn({ name: "member_id", type: "uuid" })
    memberId!: string

    /** The workspace of the room. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** `owner` or `member`. */
    @Column({ type: "text", default: () => "'member'" })
    role!: string

    /** Messages created after this instant are unread. */
    @Column({ name: "last_read_at", type: "timestamptz" })
    lastReadAt!: Date

    /** Whether the member muted the room. */
    @Column({ type: "boolean", default: () => "false" })
    muted!: boolean
}
