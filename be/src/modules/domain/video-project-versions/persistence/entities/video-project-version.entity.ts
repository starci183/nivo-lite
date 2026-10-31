import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "video_project_versions" })
/** One snapshot of a video project's script and spec, taken next to the render it started. */
export class VideoProjectVersionEntity extends UuidAbstractEntity {
    /** The project the snapshot belongs to. */
    @Column({ name: "project_id", type: "uuid" })
    projectId!: string

    /** The workspace of the project. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The version number within the project. */
    @Column({ name: "version", type: "int" })
    version!: number

    /** The script as JSON. */
    @Column({ name: "script", type: "jsonb" })
    script!: unknown

    /** The validated spec as JSON, when there was one. */
    @Column({ name: "spec", type: "jsonb", nullable: true })
    spec!: unknown

    /** The render the snapshot started. */
    @Column({ name: "render_id", type: "uuid", nullable: true })
    renderId!: string | null

    /** A note about the version. */
    @Column({ name: "note", type: "text", nullable: true })
    note!: string | null

    /** The person who asked for it, or null when an agent did. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null
}
