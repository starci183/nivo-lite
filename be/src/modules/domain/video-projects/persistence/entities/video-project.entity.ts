import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** The business goals a project may have, as the table checks them. */
export type VideoProjectGoal = "service" | "offer" | "testimonial" | "behind_scenes" | "hiring" | "custom"

/** The output shapes the table allows. */
export type VideoProjectAspect = "9:16" | "1:1" | "16:9"

/** Where a project stands, as the table checks it. */
export type VideoProjectState = "draft" | "scripting" | "rendering" | "ready" | "approved" | "published" | "archived"

/** A JSON document the jsonb columns store: an object or a list. */
export type VideoProjectJson = object

@Entity({ schema: "public", name: "video_projects" })
/** One video project of a workspace: its brief, its scenes, the render it points at and its approval. */
export class VideoProjectEntity {
    /** The project id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The working title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The business goal. */
    @Column({ name: "goal", type: "text", default: () => "'service'" })
    goal!: VideoProjectGoal

    /** The output shape. */
    @Column({ name: "aspect", type: "text", default: () => "'9:16'" })
    aspect!: VideoProjectAspect

    /** The target duration, seconds. */
    @Column({ name: "target_seconds", type: "int", default: () => "30" })
    targetSeconds!: number

    /** Where the project stands. */
    @Column({ name: "status", type: "text", default: () => "'draft'" })
    status!: VideoProjectState

    /** The workspace-checked sources and media. */
    @Column({ name: "inputs", type: "jsonb", default: () => "'{}'::jsonb" })
    inputs!: VideoProjectJson

    /** The editable scenes. */
    @Column({ name: "script", type: "jsonb", default: () => "'[]'::jsonb" })
    script!: VideoProjectJson

    /** The validated spec of the render in flight, or null. */
    @Column({ name: "current_spec", type: "jsonb", nullable: true })
    currentSpec!: VideoProjectJson | null

    /** The render the project points at, or null. */
    @Column({ name: "render_id", type: "uuid", nullable: true })
    renderId!: string | null

    /** Every render the project ever started. */
    @Column({ name: "render_ids", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    renderIds!: Array<string>

    /** The version the next render snapshots. */
    @Column({ name: "version", type: "int", default: () => "1" })
    version!: number

    /** The elapsed script time, ms, or null. */
    @Column({ name: "script_ms", type: "int", nullable: true })
    scriptMs!: number | null

    /** The metadata of the scripting operation that owns the project. */
    @Column({ name: "script_meta", type: "jsonb", default: () => "'{}'::jsonb" })
    scriptMeta!: VideoProjectJson

    /** The reason of the last failure, or null. */
    @Column({ name: "last_error", type: "text", nullable: true })
    lastError!: string | null

    /** The project this one was copied from, or null. */
    @Column({ name: "source_project_id", type: "uuid", nullable: true })
    sourceProjectId!: string | null

    /** The name of the first approver, or null. */
    @Column({ name: "approved_by_name", type: "text", nullable: true })
    approvedByName!: string | null

    /** When it was approved, or null. */
    @Column({ name: "approved_at", type: "timestamptz", nullable: true })
    approvedAt!: Date | null

    /** The work item that publishes it, or null. */
    @Column({ name: "publish_work_item_id", type: "uuid", nullable: true })
    publishWorkItemId!: string | null

    /** When it was published, or null. */
    @Column({ name: "published_at", type: "timestamptz", nullable: true })
    publishedAt!: Date | null

    /** The account that created it; null for a delegated script. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null

    /** When the row was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the row last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
