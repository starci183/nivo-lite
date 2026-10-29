import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "video_delegations" })
/** A script another agent delegated to AI Editor and how its render came back. */
export class VideoDelegationEntity {
    /** The delegation id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The render_script work item that carried the script. */
    @Column({ name: "work_item_id", type: "uuid" })
    workItemId!: string

    /** The project made of the script. */
    @Column({ name: "project_id", type: "uuid" })
    projectId!: string

    /** The delegating module. */
    @Column({ name: "source_module", type: "text" })
    sourceModule!: string

    /** The AI Marketing draft it belongs to, or null. */
    @Column({ name: "content_item_id", type: "uuid", nullable: true })
    contentItemId!: string | null

    /** The target channels. */
    @Column({ name: "channels", type: "text", array: true, default: () => "'{}'::text[]" })
    channels!: Array<string>

    /** The lifecycle: rendering, then ready or failed. */
    @Column({ name: "status", type: "text", default: "rendering" })
    status!: string

    /** The queued render, once linked. */
    @Column({ name: "render_id", type: "uuid", nullable: true })
    renderId!: string | null

    /** The approval work item that decides the posted card. */
    @Column({ name: "approval_work_item_id", type: "uuid", nullable: true })
    approvalWorkItemId!: string | null

    /** The card AI Editor posted. */
    @Column({ name: "card", type: "jsonb", nullable: true })
    card!: object | null

    /** Why the render failed, when it did. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** When the delegation was recorded. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the delegation last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
