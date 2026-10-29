import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** Where a generation stands; the table holds it under a CHECK. */
export type AiGenerationStatus = "queued" | "running" | "done" | "error" | "cancelled"

@Entity({ schema: "public", name: "ai_generations" })
/** One text the app asked OpenClaw to write: the prompt, the answer and the metering of public.ai_generations. */
export class AiGenerationEntity {
    /** The generation. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that asked. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** What the text is for. */
    @Column({ name: "purpose", type: "text" })
    purpose!: string

    /** The usage module. */
    @Column({ name: "module", type: "text", default: () => "'other'::text" })
    module!: string

    /** The usage kind. */
    @Column({ name: "usage_kind", type: "text", default: () => "'engine'::text" })
    usageKind!: string

    /** Constrained by a CHECK in the table. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: AiGenerationStatus

    /** The prompt: messages, response_format, timeout_ms and the trusted context. */
    @Column({ name: "input", type: "jsonb", default: () => "'{}'::jsonb" })
    input!: object

    /** The output: `{ text }` and, once applied, `{ result }`. */
    @Column({ name: "output", type: "jsonb", nullable: true })
    output!: object | null

    /** The stored engine or application failure. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** The marks the run reported. */
    @Column({ name: "timings", type: "jsonb", default: () => "'{}'::jsonb" })
    timings!: object

    /** The usage the run reported. */
    @Column({ name: "usage", type: "jsonb", nullable: true })
    usage!: object | null

    /** Creation instant. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** Completion instant. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
