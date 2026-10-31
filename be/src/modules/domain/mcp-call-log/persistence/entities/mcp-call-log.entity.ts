import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** The masked arguments of a gateway call, as stored JSON. */
export interface McpMaskedArguments {
    /** One masked argument. */
    [name: string]: string | number | boolean | null | object
}

@Entity({ schema: "public", name: "mcp_call_log" })
/** One append-only audit line of an MCP gateway call. */
export class McpCallLogEntity extends UuidAbstractEntity {
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
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The work item the call served, or null. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The masked arguments. */
    @Column({ name: "args_masked", type: "jsonb", default: () => "'{}'::jsonb" })
    argsMasked!: McpMaskedArguments

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
}
