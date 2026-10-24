import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpGatewayReceiptsOptions } from "./mcp-gateway-receipts.options"

/** The configurable-module base of MCP gateway receipts; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<McpGatewayReceiptsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
