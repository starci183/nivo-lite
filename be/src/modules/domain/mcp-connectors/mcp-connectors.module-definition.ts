import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpConnectorsOptions } from "./mcp-connectors.options"

/** Configurable-module base of the mcp-connectors capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<McpConnectorsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
