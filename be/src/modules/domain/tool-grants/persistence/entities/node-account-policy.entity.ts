import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { GrantMode, NodePolicyOrigin } from "../../tool-grants.contracts"

@Entity({ schema: "public", name: "node_account_policies" })
/**
 * One operation a node of an agent's workflow may call on one connected account, with its mode: the node-level grant and the record of
 * who agreed it. Keyed by the node's KEY in its workflow, never by a version, so it survives a new version of the graph.
 */
export class NodeAccountPolicyEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The workflow of the agent. */
    @Column({ name: "workflow_id", type: "uuid" })
    workflowId!: string

    /** The key of the node within the workflow's graph. */
    @Column({ name: "node_key", type: "text" })
    nodeKey!: string

    /** The connected account. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The operation: the full tool id. */
    @Column({ name: "operation", type: "text" })
    operation!: string

    /**
     * The place of the account's PROVIDER in the node's ordered list of providers (0 = the first): the providers of one node are
     * alternatives, tried in this order. Orders only; nothing allows or refuses by it.
     */
    @Column({ name: "position", type: "smallint", default: 0 })
    position!: number

    /** `auto` (the node calls it by itself) or `ask` (each call waits for a person). */
    @Column({ name: "mode", type: "text" })
    mode!: GrantMode

    /** Where the row came from: `template`, `owner` or `migration`. */
    @Column({ name: "origin", type: "text" })
    origin!: NodePolicyOrigin

    /**
     * The WORKFLOW version the row was first derived from or agreed for, or null: the PROVENANCE of the grant (which version the
     * owner, a template or the move looked at when the row was written). It is never re-stamped when a later version is accepted:
     * the row is held by the node (agent, workflow, node key), not by a version, and whether the RUNNING version still asks for the
     * operation is read from that version itself by the judge. Nothing decides by this column.
     */
    @Column({ name: "from_version_id", type: "uuid", nullable: true })
    fromVersionId!: string | null

    /** The member who agreed it, or null. */
    @Column({ name: "agreed_by", type: "uuid", nullable: true })
    agreedBy!: string | null

    /** When it was agreed, or null. */
    @Column({ name: "agreed_at", type: "timestamptz", nullable: true })
    agreedAt!: Date | null
}
