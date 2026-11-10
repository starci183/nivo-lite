import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { AbilityTicks } from "../../mcp-tool-grants.contracts"

@Entity({ schema: "public", name: "mcp_connector_access" })
/** One agent of a workspace attached to one connected account (a connection), with the abilities ticked for it on that account. */
export class McpConnectorAccessEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The connected account: the connection the agent is attached to. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The provider of that connection (`zalo_oa`, `telegram`, `meta`, `sepay`, `google`). */
    @Column({ name: "provider", type: "text" })
    provider!: string

    /** The abilities ticked, by ability id: `auto` (used by itself) or `ask` (each use waits for a person). */
    @Column({ name: "abilities", type: "jsonb", default: () => "'{}'::jsonb" })
    abilities!: AbilityTicks

    /** Who set it, or null for the seed. */
    @Column({ name: "updated_by", type: "uuid", nullable: true })
    updatedBy!: string | null
}
