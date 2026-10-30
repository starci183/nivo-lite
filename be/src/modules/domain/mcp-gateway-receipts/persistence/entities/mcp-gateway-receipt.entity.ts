import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "mcp_gateway_receipts" })
/** The sealed pending or final outcome of one gateway operation. */
export class McpGatewayReceiptEntity extends AbstractEntity {
    /** The workspace that ran the operation. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The operation's idempotency key. */
    @PrimaryColumn({ name: "operation_key", type: "text" })
    operationKey!: string

    /** The sealed pending intent or connector outcome. */
    @Column({ name: "result_sealed", type: "text" })
    resultSealed!: string
}
