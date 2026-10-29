import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** The render lifecycle states stored in `status`. */
export type VideoRenderState = "queued" | "rendering" | "done" | "failed"

@Entity({ schema: "public", name: "video_renders" })
/** One render of a video project: queued by the video capability's transaction and settled by the render job. */
export class VideoRenderEntity {
    /** The render id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace the render belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The spec stored with the render. */
    @Column({ name: "spec", type: "jsonb" })
    spec!: object

    /** The stored lifecycle state. */
    @Column({ name: "status", type: "text", default: "queued" })
    status!: VideoRenderState

    /** The completed percentage. */
    @Column({ name: "progress", type: "int", default: 0 })
    progress!: number

    /** The renderer stage code. */
    @Column({ name: "stage", type: "text", nullable: true })
    stage!: string | null

    /** The video output path. */
    @Column({ name: "output_path", type: "text", nullable: true })
    outputPath!: string | null

    /** The poster output path. */
    @Column({ name: "poster_path", type: "text", nullable: true })
    posterPath!: string | null

    /** The video duration. */
    @Column({ name: "duration_ms", type: "int", nullable: true })
    durationMs!: number | null

    /** The file size; PostgreSQL returns a bigint as text. */
    @Column({ name: "size_bytes", type: "bigint", nullable: true })
    sizeBytes!: string | null

    /** Why the render failed. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** The attempts counter and the renderer's report. */
    @Column({ name: "meta", type: "jsonb", default: () => "'{}'::jsonb" })
    meta!: Record<string, unknown>

    /** The person who asked for it, or null when an agent did. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null

    /** When the render was queued. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the row last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date

    /** When the first delivery took the render. */
    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null

    /** When the render settled. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
