import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { PipelineConfig } from "../../automation-pipelines.contracts"

@Entity({ schema: "public", name: "automation_pipelines" })
/** One automation template switched on, off or hidden in one workspace. */
export class AutomationPipelineEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The template key. */
    @Column({ name: "template_key", type: "text" })
    templateKey!: string

    /** The display name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The owning module. */
    @Column({ name: "module_key", type: "text", nullable: true })
    moduleKey!: string | null

    /** True when on. */
    @Column({ name: "enabled", type: "boolean", default: () => "false" })
    enabled!: boolean

    /** True when hidden by the owner. */
    @Column({ name: "dismissed", type: "boolean", default: () => "false" })
    dismissed!: boolean

    /** The saved settings. */
    @Column({ name: "config", type: "jsonb", default: () => "'{}'::jsonb" })
    config!: PipelineConfig

    /** The approved message template. */
    @Column({ name: "body", type: "text", nullable: true })
    body!: string | null

    /** How many times the body was saved. */
    @Column({ name: "body_version", type: "integer", default: () => "0" })
    bodyVersion!: number

    /** The template version it was created with. */
    @Column({ name: "template_version", type: "integer", default: () => "1" })
    templateVersion!: number

    /** The context version the body was written from. */
    @Column({ name: "based_on_context", type: "integer", nullable: true })
    basedOnContext!: number | null

    /** Consecutive approvals without edits. */
    @Column({ name: "approval_streak", type: "integer", default: () => "0" })
    approvalStreak!: number

    /** When "send by itself" was offered. */
    @Column({ name: "trust_offered_at", type: "timestamptz", nullable: true })
    trustOfferedAt!: Date | null

    /** True when the owner accepted it. */
    @Column({ name: "auto_send", type: "boolean", default: () => "false" })
    autoSend!: boolean

    /** The member that created it. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null
}
