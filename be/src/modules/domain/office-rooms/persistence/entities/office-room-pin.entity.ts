import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "office_rooms_pins" })
/** One document pinned in a room: one row of `public.office_rooms_pins`. */
export class OfficeRoomPinEntity {
    /** The pin. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

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

    /** When the document was pinned. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
