import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "brain_commands" })
/** One row of public.brain_commands. */
export class BrainCommandEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The requested by. */
    @Column({ name: "requested_by", type: "uuid" })
    requestedBy!: string

    /** The kind. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The payload. */
    @Column({ name: "payload", type: "jsonb", default: () => "'{}'::jsonb" })
    payload!: object

    /** The status. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: "queued" | "running" | "done" | "failed"

    /** The result. */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: object | null

    /** The error code. */
    @Column({ name: "error_code", type: "text", nullable: true })
    errorCode!: string | null

    /** The created at. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** The finished at. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
