import { defineCapabilityModule } from "@starci/nest-kit"
import type { McpGatewayReceiptsOptions } from "./mcp-gateway-receipts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<McpGatewayReceiptsOptions>()
