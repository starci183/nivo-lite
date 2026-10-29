import { McpGatewayReceiptEntity } from "./mcp-gateway-receipt.entity"

export { McpGatewayReceiptEntity }

/** The entities the mcp-gateway-receipts capability owns, collected by the database module. */
export const mcpGatewayReceiptsEntities = [McpGatewayReceiptEntity] as const
