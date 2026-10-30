import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "brain_extractions" })
/** One row of public.brain_extractions. */
export class BrainExtractionEntity extends AbstractEntity {
    /** The source id. */
    @PrimaryColumn({ name: "source_id", type: "uuid" })
    sourceId!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The status. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: "queued" | "running" | "done" | "failed" | "blocked_credits"

    /** The facts proposed. */
    @Column({ name: "facts_proposed", type: "int", default: () => "0" })
    factsProposed!: number

    /** The error. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** The model. */
    @Column({ name: "model", type: "text", nullable: true })
    model!: string | null

    /** The prompt version. */
    @Column({ name: "prompt_version", type: "int" })
    promptVersion!: number

    /** The content hash. */
    @Column({ name: "content_hash", type: "text", nullable: true })
    contentHash!: string | null

    /** The windows total. */
    @Column({ name: "windows_total", type: "int", default: () => "0" })
    windowsTotal!: number

    /** The windows done. */
    @Column({ name: "windows_done", type: "int", default: () => "0" })
    windowsDone!: number

    /** The attempts. */
    @Column({ name: "attempts", type: "int", default: () => "0" })
    attempts!: number

    /** The orphan fact ids. */
    @Column({ name: "orphan_fact_ids", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    orphanFactIds!: Array<string>
}
