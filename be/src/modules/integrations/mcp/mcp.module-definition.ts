import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpOptions } from "./mcp.options"

/** Configurable-module base of the remote MCP client. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<McpOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
