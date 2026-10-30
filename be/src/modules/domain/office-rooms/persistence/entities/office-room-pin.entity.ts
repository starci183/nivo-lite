import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "office_rooms_pins" })
/** One document pinned in a room: one row of `public.office_rooms_pins`. */
export class OfficeRoomPinEntity extends UuidAbstractEntity {
    /** The room the document is pinned in. */
    @Column({ name: "room_id", type: "uuid" })
    roomId!: string

    /** The document title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** Where the document opens, when it does. */
    @Column({ name: "href", type: "text", nullable: true })
    href!: string | null

    /** The line under the title. */
    @Column({ name: "note", type: "text", default: "" })
    note!: string
}
