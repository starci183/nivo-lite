import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "mcp_default_accounts" })
/** The one account of a kind a workspace uses by default where a tool must not choose between accounts (the receiving account of a payment QR). */
export class McpDefaultAccountEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The kind of account (`payment`). */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The connection that is the default. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** Who set it. */
    @Column({ name: "updated_by", type: "uuid", nullable: true })
    updatedBy!: string | null
}
