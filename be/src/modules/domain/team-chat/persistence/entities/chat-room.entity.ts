import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { RoomKind, RoomPurpose } from "../../team-chat.contracts"

@Entity({ schema: "public", name: "chat_rooms" })
/** One row of public.chat_rooms: a direct room of two members or a named group of any number. */
export class ChatRoomEntity extends UuidAbstractEntity {
    /** The workspace the room belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** `direct` or `group`. */
    @Column({ type: "text" })
    kind!: RoomKind

    /** The name of a group; null for a direct room. */
    @Column({ type: "text", nullable: true })
    name!: string | null

    /** Where the room sorts among rooms that have no message. */
    @Column({ type: "integer", default: () => "0" })
    position!: number

    /** The pair of a direct room, sorted, so the same pair has one room; null for a group. */
    @Column({ name: "direct_key", type: "text", nullable: true })
    directKey!: string | null

    /** What the room is for: `direct`, a plain `group`, the `common` room of the workspace or the `module` room of one team. */
    @Column({ type: "text", default: () => "'group'" })
    purpose!: RoomPurpose

    /** The module whose team room this is; null unless the purpose is `module`. */
    @Column({ name: "purpose_module", type: "text", nullable: true })
    purposeModule!: string | null

    /** The account that created the room. */
    @Column({ name: "created_by", type: "uuid" })
    createdBy!: string
}
