import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { McpCallLogOptions } from "./mcp-call-log.options"

/** Configurable-module base of the mcp-call-log capability. */
const definition = new ConfigurableModuleBuilder<McpCallLogOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    McpCallLogOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: McpCallLogOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
