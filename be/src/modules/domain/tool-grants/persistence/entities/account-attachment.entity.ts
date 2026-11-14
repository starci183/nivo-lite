import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "mcp_connector_access" })
/** One agent of a workspace attached to one connected account (a connection): the hard right; detaching it is the kill switch. */
export class AccountAttachmentEntity extends UuidAbstractEntity {
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

    /**
     * True for the agent's DEFAULT account of that provider: the one a step's call uses when several accounts of the provider are attached
     * and neither the run's trigger nor the run's earlier calls name one. At most one per agent and provider (a partial unique index).
     */
    @Column({ name: "is_default", type: "boolean", default: () => "false" })
    isDefault!: boolean

    /** Who set it, or null for the seed. */
    @Column({ name: "updated_by", type: "uuid", nullable: true })
    updatedBy!: string | null
}
