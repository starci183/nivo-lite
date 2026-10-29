import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "office_rooms" })
/** One department room of a workspace: one row of `public.office_rooms`. */
export class OfficeRoomEntity {
    /** The room. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace the room belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The department key, a member of the table check. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** The display name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The order in the room list. */
    @Column({ name: "position", type: "integer", default: 0 })
    position!: number

    /** The module kinds the room covers. */
    @Column({ name: "modules", type: "text", array: true, default: () => "'{}'::text[]" })
    modules!: Array<string>

    /** When the room was opened. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
