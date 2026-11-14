import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { TruthReadLine } from "../../tool-call-log.contracts"

/** The masked arguments of a gateway call, as stored JSON. */
export interface ToolMaskedArguments {
    /** One masked argument. */
    [name: string]: string | number | boolean | null | object
}

@Entity({ schema: "public", name: "mcp_call_log" })
/** One append-only audit line of an tools registry call. */
export class ToolCallLogEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connector key. */
    @Column({ name: "connector", type: "text" })
    connector!: string

    /** The full tool name. */
    @Column({ name: "tool", type: "text" })
    tool!: string

    /** The agent, or null. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The conversation the call served, or null. */
    @Column({ name: "route_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The work item the call served, or null. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The masked arguments. */
    @Column({ name: "args_masked", type: "jsonb", default: () => "'{}'::jsonb" })
    argsMasked!: ToolMaskedArguments

    /** The sha256 of the canonical real arguments. */
    @Column({ name: "args_hash", type: "text", default: () => "''" })
    argsHash!: string

    /** `ok`, `error`, `refused`, `approval`, `timeout` or `circuit_open`. */
    @Column({ name: "outcome", type: "text" })
    outcome!: string

    /** The failure code, or null. */
    @Column({ name: "error_code", type: "text", nullable: true })
    errorCode!: string | null

    /** The masked summary of the result. */
    @Column({ name: "result_summary", type: "text", default: () => "''" })
    resultSummary!: string

    /** How long it took, milliseconds. */
    @Column({ name: "duration_ms", type: "integer", default: () => "0" })
    durationMs!: number

    /** Who approved it, or null. */
    @Column({ name: "approved_by", type: "text", nullable: true })
    approvedBy!: string | null

    /** The run (agent turn) the call was made in, or null (migration 20261112015300). */
    @Column({ name: "run_id", type: "text", nullable: true })
    runId!: string | null

    /** The truths a truth-graph read served, `[{ factId, version }]`, or null (migration 20261112015300). */
    @Column({ name: "fact_reads", type: "jsonb", nullable: true })
    factReads!: ReadonlyArray<TruthReadLine> | null

    /** Where the call came from (`node`, or the road outside every node), or null when the caller stated none (migration 20261112021200). */
    @Column({ name: "origin_kind", type: "text", nullable: true })
    originKind!: string | null

    /** The key of the graph node whose step made the call, or null (migration 20261112021200). */
    @Column({ name: "node_key", type: "text", nullable: true })
    nodeKey!: string | null

    /** The workflow of that node, or null (migration 20261112021200). */
    @Column({ name: "workflow_id", type: "text", nullable: true })
    workflowId!: string | null

    /** The version the run of that node is pinned to, or null (migration 20261112021200). */
    @Column({ name: "workflow_version_id", type: "text", nullable: true })
    workflowVersionId!: string | null

    /** The records an `ok` read answered, as its adapter stated them; null when it stated none (migration 20261112021900). */
    @Column({ name: "records_read", type: "integer", nullable: true })
    recordsRead!: number | null

    /** The records an `ok` write changed, as its adapter stated them; null when it stated none (migration 20261112021900). */
    @Column({ name: "records_changed", type: "integer", nullable: true })
    recordsChanged!: number | null

    /** The connected account the call acted on, as the tool runner handed it; null when it handed none (migration 20261112022400). */
    @Column({ name: "connection_id", type: "text", nullable: true })
    connectionId!: string | null

    /** That account's provider key, or null (migration 20261112022400). */
    @Column({ name: "provider", type: "text", nullable: true })
    provider!: string | null

    /** Which try of the call this line is, from 1 (a fallback is a later try), or null (migration 20261112022400). */
    @Column({ name: "attempt", type: "smallint", nullable: true })
    attempt!: number | null

    /** How the account was chosen (`data_owner`, `order`, `fallback`), or null (migration 20261112022400). */
    @Column({ name: "chosen_by", type: "text", nullable: true })
    chosenBy!: string | null

    /** The API key an outbound MCP call was made with, or null (migration 20261113090200). */
    @Column({ name: "api_key_id", type: "uuid", nullable: true })
    apiKeyId!: string | null

    /** The account the call ran as (the key's holder), or null (migration 20261113090200). */
    @Column({ name: "actor_user_id", type: "uuid", nullable: true })
    actorUserId!: string | null
}
