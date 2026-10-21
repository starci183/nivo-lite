import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpToolGrantsOptions } from "./mcp-tool-grants.options"

/** Configurable-module base of the mcp-tool-grants capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<McpToolGrantsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
