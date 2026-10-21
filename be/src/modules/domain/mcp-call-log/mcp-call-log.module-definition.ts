import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { McpCallLogOptions } from "./mcp-call-log.options"

/** Configurable-module base of the mcp-call-log capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<McpCallLogOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
