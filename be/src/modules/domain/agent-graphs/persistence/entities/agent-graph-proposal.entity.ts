import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { ProposalKind, ProposalStatus } from "../../agent-graphs.contracts"

@Entity({ schema: "public", name: "agent_graph_proposals" })
/** A change to a graph that something proposed (a changed Brain rule, a streak of decisions, a newer template) and a person decides. */
export class AgentGraphProposalEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** Unique per agent: the same cause never raises two proposals. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** What raised it. */
    @Column({ name: "kind", type: "text" })
    kind!: ProposalKind

    /** Where it stands. */
    @Column({ name: "status", type: "text", default: () => "'open'" })
    status!: ProposalStatus

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
    @Column({ name: "patch", type: "jsonb", default: () => "'{}'::jsonb" })
    patch!: Record<string, unknown>

    /** True when applying it would give the agent more reach. */
    @Column({ name: "widens", type: "boolean", default: false })
    widens!: boolean

    /** The evidence: decision ids, old and new passages. */
    @Column({ name: "evidence", type: "jsonb", default: () => "'[]'::jsonb" })
    evidence!: Array<string>

    /** Who decided it, or null. */
    @Column({ name: "decided_by", type: "uuid", nullable: true })
    decidedBy!: string | null

    /** When it was decided, or null. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null

    /** The version that applying it published, or null. */
    @Column({ name: "result_version_id", type: "uuid", nullable: true })
    resultVersionId!: string | null
}
