import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "node_policy_shadow_tallies" })
/**
 * One count of the shadow compare: how often the agent-level rights decided `realCode` where the node policy would have decided
 * `shadowCode`, for one agent, road, node and tool. Ids, codes and counts only. `tallyKey` is the hash of the counted tuple.
 */
export class NodePolicyShadowTallyEntity extends UuidAbstractEntity {
    /** The hash of (agent, origin kind, workflow, node, tool, real code, shadow code): one row per tuple. */
    @Column({ name: "tally_key", type: "text" })
    tallyKey!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The road the call came by. */
    @Column({ name: "origin_kind", type: "text" })
    originKind!: string

    /** The workflow of the step, or null. */
    @Column({ name: "workflow_id", type: "text", nullable: true })
    workflowId!: string | null

    /** The node key of the step, or null. */
    @Column({ name: "node_key", type: "text", nullable: true })
    nodeKey!: string | null

    /** The tool (or work action) judged. */
    @Column({ name: "tool", type: "text" })
    tool!: string

    /** What the agent-level rights decided. */
    @Column({ name: "real_code", type: "text" })
    realCode!: string

    /** What the node policy would have decided, or why it was not compared. */
    @Column({ name: "shadow_code", type: "text" })
    shadowCode!: string

    /** How many calls; a bigint the driver answers as text. */
    @Column({ name: "calls", type: "bigint", default: () => "0" })
    calls!: string

    /** The pinned version of the latest such call, or null. */
    @Column({ name: "last_version_id", type: "text", nullable: true })
    lastVersionId!: string | null
}
