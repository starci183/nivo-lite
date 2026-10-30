import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { ArgConstraint, GrantMode } from "../../mcp-tool-grants.contracts"

@Entity({ schema: "public", name: "mcp_tool_grants" })
/** One grant of a gateway tool to an agent of a workspace. */
export class McpToolGrantEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The full tool name or `connector.*`. */
    @Column({ name: "tool", type: "text" })
    tool!: string

    /** `auto`, `ask` or `never`. */
    @Column({ name: "mode", type: "text", default: () => "'never'" })
    mode!: GrantMode

    /** The amount limit (bigint text from the driver), or null. */
    @Column({ name: "limit_vnd", type: "bigint", nullable: true })
    limitVnd!: string | number | null

    /** The argument constraints (a JSON array). */
    @Column({ name: "constraints", type: "jsonb", default: () => "'[]'::jsonb" })
    constraints!: Array<ArgConstraint>

    /** Who set the grant, or null. */
    @Column({ name: "updated_by", type: "uuid", nullable: true })
    updatedBy!: string | null
}
