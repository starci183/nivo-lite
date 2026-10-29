import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "n8n_runs" })
/** One run of a shared n8n workflow: one row of `public.n8n_runs`. */
export class N8nRunEntity {
    /** The run. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The template key of the workflow. */
    @Column({ name: "template_key", type: "text" })
    templateKey!: string

    /** The occurrence the run is for: one run per (workspace, template, dedupe key). */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** The hex SHA-256 of the run token. */
    @Column({ name: "token_hash", type: "text" })
    tokenHash!: string

    /** When the token stops working. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date

    /** How the run stands (queued, done, failed, skipped). */
    @Column({ name: "status", type: "text", default: () => "'queued'" })
    status!: string

    /** What the run did, in words. */
    @Column({ name: "summary", type: "text", nullable: true })
    summary!: string | null

    /** What n8n reported, bounded. */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: Readonly<Record<string, unknown>> | null

    /** The engine job that carried the run, when one did. */
    @Column({ name: "engine_job_id", type: "uuid", nullable: true })
    engineJobId!: string | null

    /** When the run was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the run was closed. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
