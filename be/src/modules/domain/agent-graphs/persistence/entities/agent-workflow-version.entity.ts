import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_workflow_versions" })
/** One version of a workflow: the full snapshot of its graph, numbered per workflow. Inserted once, never changed. */
export class AgentWorkflowVersionEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The workflow. */
    @Column({ name: "workflow_id", type: "uuid" })
    workflowId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The number within the workflow. */
    @Column({ name: "number", type: "integer" })
    number!: number

    /** The snapshot of the graph. */
    @Column({ name: "document", type: "jsonb" })
    document!: object

    /** The hash of the snapshot. */
    @Column({ name: "document_hash", type: "text" })
    documentHash!: string

    /** How it came to be. */
    @Column({ name: "change_kind", type: "text" })
    changeKind!: string

    /** `owner`, `nivo` or `system`. */
    @Column({ name: "author_kind", type: "text" })
    authorKind!: string

    /** The member who wrote it, or null. */
    @Column({ name: "author_id", type: "uuid", nullable: true })
    authorId!: string | null

    /** A note of the author. */
    @Column({ name: "note", type: "text" })
    note!: string

    /** The template it came from, or null. */
    @Column({ name: "template_id", type: "text", nullable: true })
    templateId!: string | null

    /** The version of that template, or null. */
    @Column({ name: "template_version", type: "integer", nullable: true })
    templateVersion!: number | null

    /** The number it was rolled back or copied from, or null. */
    @Column({ name: "from_number", type: "integer", nullable: true })
    fromNumber!: number | null

    /** The agent graph version a primary workflow version mirrors, or null. */
    @Column({ name: "graph_version_id", type: "uuid", nullable: true })
    graphVersionId!: string | null

    /** When it was published. */
    @Column({ name: "published_at", type: "timestamptz" })
    publishedAt!: Date
}
