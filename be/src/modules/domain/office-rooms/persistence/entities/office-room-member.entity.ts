import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "office_rooms_members" })
/** One seat in a room, held by an agent or a person: one row of `public.office_rooms_members`. */
export class OfficeRoomMemberEntity {
    /** The seat. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The room the seat is in. */
    @Column({ name: "room_id", type: "uuid" })
    roomId!: string

    /** The seated agent, or null for a person. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The seated account, or null for an agent. */
    @Column({ name: "user_id", type: "uuid", nullable: true })
    userId!: string | null

    /** Whether the room is the home room of the seated agent, so its lines land here. */
    @Column({ name: "is_home", type: "boolean", default: false })
    isHome!: boolean

    /** When the seat was taken. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
