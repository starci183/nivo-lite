import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "chat_room_pins" })
/** One row of public.chat_room_pins: a message pinned in its room. */
export class ChatRoomPinEntity extends AbstractEntity {
    /** The room. */
    @PrimaryColumn({ name: "room_id", type: "uuid" })
    roomId!: string

    /** The pinned message. */
    @PrimaryColumn({ name: "message_id", type: "uuid" })
    messageId!: string

    /** The workspace of the room. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The account that pinned it. */
    @Column({ name: "pinned_by", type: "uuid" })
    pinnedBy!: string
}
