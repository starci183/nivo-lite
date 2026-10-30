import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "connection_commands" })
/** One row of public.connection_commands: a console command a member submitted, until its outcome is read back. */
export class ConnectionCommandEntity extends UuidAbstractEntity {
    /** The workspace the command acts in; every effect stays inside it. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The member who issued the command, whose role authorises it. */
    @Column({ name: "user_id", type: "uuid" })
    userId!: string

    /** The command kind that selects the handler. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The raw input the handler parses; untrusted until the kind reads it. */
    @Column({ name: "input", type: "jsonb", default: () => "'{}'::jsonb" })
    input!: unknown

    /** Where the command is in its life: pending or done (the table checks it); the mapper narrows it. */
    @Column({ name: "status", type: "text", default: () => "'pending'::text" })
    status!: string

    /** What the command answered, written when it is done. */
    @Column({ name: "outcome", type: "jsonb", nullable: true })
    outcome!: object | null

    /** The finished at. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
