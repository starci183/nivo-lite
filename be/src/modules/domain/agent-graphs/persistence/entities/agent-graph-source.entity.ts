import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_graph_sources" })
/** One source of one node or branch of a version, indexed so a changed Brain fact can be found without opening every version. */
export class AgentGraphSourceEntity extends AbstractEntity {
    /** The version. */
    @PrimaryColumn({ name: "version_id", type: "uuid" })
    versionId!: string

    /** The node. */
    @PrimaryColumn({ name: "node_key", type: "text" })
    nodeKey!: string

    /** The branch, or an empty text for the node itself. */
    @PrimaryColumn({ name: "branch_key", type: "text" })
    branchKey!: string

    /** The kind of source. */
    @PrimaryColumn({ name: "kind", type: "text" })
    kind!: string

    /** The reference: a fact id, a template key, a message id. */
    @PrimaryColumn({ name: "ref", type: "text" })
    ref!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The hash of the value the rule held when the owner confirmed it. */
    @Column({ name: "value_hash", type: "text", default: () => "''" })
    valueHash!: string
}
