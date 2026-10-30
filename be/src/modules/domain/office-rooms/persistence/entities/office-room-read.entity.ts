import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "office_rooms_reads" })
/** Where one person last read one room, '' being the Office room: one row of `public.office_rooms_reads`. */
export class OfficeRoomReadEntity extends AbstractEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The reading account. */
    @PrimaryColumn({ name: "user_id", type: "uuid" })
    userId!: string

    /** The room key, or a scope key such as `agent:<id>` or `lead:<id>`. */
    @PrimaryColumn({ name: "room", type: "text" })
    room!: string

    /** The instant of the newest line the person has read. */
    @Column({ name: "last_read_at", type: "timestamptz", default: () => "now()" })
    lastReadAt!: Date
}
