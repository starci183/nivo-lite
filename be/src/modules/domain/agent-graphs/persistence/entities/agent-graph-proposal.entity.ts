import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_graph_proposals" })
/** A change the engine proposes to the graph of an agent, raised once per cause (`dedupe_key`) and decided by a person; `version` fences writes. */
export class AgentGraphProposalEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The cause it is raised once for. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** What raised it. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** Where it stands. */
    @Column({ name: "status", type: "text" })
    status!: string

    /** The version it was raised against, or null. */
    @Column({ name: "base_version_id", type: "uuid", nullable: true })
    baseVersionId!: string | null

    /** The node it is about, or null. */
    @Column({ name: "node_key", type: "text", nullable: true })
    nodeKey!: string | null

    /** The branch it is about, or null. */
    @Column({ name: "branch_key", type: "text", nullable: true })
    branchKey!: string | null

    /** The change, as data. */
    @Column({ name: "patch", type: "jsonb" })
    patch!: object

    /** True when applying it would give the agent more reach. */
    @Column({ name: "widens", type: "boolean" })
    widens!: boolean

    /** The evidence, `{ ids: [...] }`. */
    @Column({ name: "evidence", type: "jsonb" })
    evidence!: object

    /** Who decided it, or null. */
    @Column({ name: "decided_by", type: "uuid", nullable: true })
    decidedBy!: string | null

    /** When it was decided, or null. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null

    /** The version its confirmation published, or null. */
    @Column({ name: "result_version_id", type: "uuid", nullable: true })
    resultVersionId!: string | null

    /** The fence of every write. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number
}
