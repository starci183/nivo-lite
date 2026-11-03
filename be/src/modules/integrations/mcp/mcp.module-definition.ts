import { defineCapabilityModule } from "@starci/nest-kit"
import { MCP_OPTIONS } from "./mcp.decorators"
import type { McpOptions } from "./mcp.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<McpOptions>({
    optionsInjectionToken: MCP_OPTIONS,
})
