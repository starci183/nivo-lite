import { defineCapabilityModule } from "@starci/nest-kit"
import { MCP_GATEWAY_OPTIONS } from "./mcp-gateway.decorators"
import type { McpGatewayOptions } from "./mcp-gateway.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<McpGatewayOptions>({
    optionsInjectionToken: MCP_GATEWAY_OPTIONS,
})
