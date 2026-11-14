import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_graph_sources" })
/** One source a node or branch of a version cites (a fact, a template, a message), so a changed source is found without opening every version. */
export class AgentGraphSourceEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The version. */
    @Column({ name: "version_id", type: "uuid" })
    versionId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The node. */
    @Column({ name: "node_key", type: "text" })
    nodeKey!: string

    /** The branch, or an empty text for the node itself. */
    @Column({ name: "branch_key", type: "text" })
    branchKey!: string

    /** The kind of source. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The reference: a fact id, a template key, a message id. */
    @Column({ name: "ref", type: "text" })
    ref!: string

    /** The hash of the value the rule held when the owner confirmed it. */
    @Column({ name: "value_hash", type: "text" })
    valueHash!: string
}
