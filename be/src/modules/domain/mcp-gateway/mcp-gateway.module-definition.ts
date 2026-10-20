import { ConfigurableModuleBuilder } from "@nestjs/common"
import { MCP_GATEWAY_OPTIONS } from "./mcp-gateway.decorators"
import type { McpGatewayOptions } from "./mcp-gateway.options"

/** Configurable-module base of the MCP gateway; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<McpGatewayOptions>({
    optionsInjectionToken: MCP_GATEWAY_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
