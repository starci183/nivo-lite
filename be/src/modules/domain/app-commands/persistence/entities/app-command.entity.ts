import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "app_commands" })
/** One ask of the web app, queued for the back end, with its outcome. */
export class AppCommandEntity {
    /** The command id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace it concerns. */
    @Column({ name: "workspace_id", type: "uuid", nullable: true })
    workspaceId!: string | null

    /** The person who asked. */
    @Column({ name: "requested_by", type: "uuid" })
    requestedBy!: string

    /** What was asked. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** What the asker typed. */
    @Column({ name: "input", type: "jsonb", default: () => "'{}'::jsonb" })
    input!: unknown

    /** Where the command stands. */
    @Column({ name: "state", type: "text", default: () => "'queued'::text" })
    state!: "queued" | "running" | "done" | "failed"

    /** The answer of a done command. */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: object | null

    /** The code the web app shows for a failed command. */
    @Column({ name: "error_code", type: "text", nullable: true })
    errorCode!: string | null

    /** When the command was queued. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the command ended. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
