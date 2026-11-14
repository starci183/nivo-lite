import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_workflows" })
/** One workflow of an agent: its key (unique per agent), its place in the list and the version that runs; `version` fences writes. */
export class AgentWorkflowEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The key, unique within the agent. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** The name the owner reads. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** `active`, `draft` or `paused`. */
    @Column({ name: "status", type: "text" })
    status!: string

    /** True for the workflow the agent's own graph mirrors. */
    @Column({ name: "is_primary", type: "boolean" })
    primary!: boolean

    /** The place in the agent's list. */
    @Column({ name: "position", type: "integer" })
    position!: number

    /** The version that runs, or null before the first. */
    @Column({ name: "active_version_id", type: "uuid", nullable: true })
    activeVersionId!: string | null

    /** The number of the newest version (0 before the first). */
    @Column({ name: "latest_number", type: "integer" })
    latestNumber!: number

    /** The template it came from, or null. */
    @Column({ name: "template_id", type: "text", nullable: true })
    templateId!: string | null

    /** The version of that template, or null. */
    @Column({ name: "template_version", type: "integer", nullable: true })
    templateVersion!: number | null

    /** The member who made it, or null. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null

    /** The fence of every write. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number
}
