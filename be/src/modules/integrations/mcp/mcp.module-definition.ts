import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { MCP_OPTIONS } from "./mcp.decorators"
import type { McpOptions } from "./mcp.options"

/** Configurable-module base of the MCP integration. */
const definition = new ConfigurableModuleBuilder<McpOptions>({
    optionsInjectionToken: MCP_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    McpOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: McpOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
