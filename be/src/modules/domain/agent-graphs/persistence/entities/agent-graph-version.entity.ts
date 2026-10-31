import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { GraphChangeKind, GraphDocument } from "../../agent-graphs.contracts"

@Entity({ schema: "public", name: "agent_graph_versions" })
/** One frozen version of a graph. The application role may only read and insert it, so the database refuses a change. */
export class AgentGraphVersionEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The number of the version within the agent. */
    @Column({ name: "version", type: "integer" })
    version!: number

    /** The frozen graph. */
    @Column({ name: "document", type: "jsonb" })
    document!: GraphDocument

    /** The hash of the document. */
    @Column({ name: "document_hash", type: "text" })
    documentHash!: string

    /** The context version it was published with, or null. */
    @Column({ name: "context_version_id", type: "uuid", nullable: true })
    contextVersionId!: string | null

    /** How the version came to be. */
    @Column({ name: "change_kind", type: "text" })
    changeKind!: GraphChangeKind

    /** A note of the publisher. */
    @Column({ name: "note", type: "text", default: () => "''" })
    note!: string

    /** Who published it, or null. */
    @Column({ name: "published_by", type: "uuid", nullable: true })
    publishedBy!: string | null

    /** When it was published. */
    @Column({ name: "published_at", type: "timestamptz", default: () => "now()" })
    publishedAt!: Date
}
