import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "content_plans" })
/** One row of public.content_plans. */
export class ContentPlanEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The month. */
    @Column({ name: "month", type: "date" })
    month!: string

    /** The status. */
    @Column({ name: "status", type: "text", default: () => "'done'::text" })
    status!: "done" | "failed"

    /** The idea count. */
    @Column({ name: "idea_count", type: "int", default: () => "0" })
    ideaCount!: number

    /** The ai ms. */
    @Column({ name: "ai_ms", type: "int", nullable: true })
    aiMs!: number | null

    /** The note. */
    @Column({ name: "note", type: "text", nullable: true })
    note!: string | null

    /** The meta. */
    @Column({ name: "meta", type: "jsonb", default: () => "'{}'::jsonb" })
    meta!: object

    /** The created by. */
    @Column({ name: "created_by", type: "text", default: () => "''::text" })
    createdBy!: string

    /** The created at. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
