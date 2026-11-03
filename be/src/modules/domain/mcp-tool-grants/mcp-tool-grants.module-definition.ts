import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { McpToolGrantsOptions } from "./mcp-tool-grants.options"

/** Configurable-module base of the mcp-tool-grants capability. */
const definition = new ConfigurableModuleBuilder<McpToolGrantsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    McpToolGrantsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: McpToolGrantsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
