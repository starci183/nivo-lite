import { ConfigurableModuleBuilder } from "@nestjs/common"
import { MCP_OPTIONS } from "./mcp.decorators"
import type { McpOptions } from "./mcp.options"

/** Configurable-module base of the MCP integration. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<McpOptions>({
    optionsInjectionToken: MCP_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
