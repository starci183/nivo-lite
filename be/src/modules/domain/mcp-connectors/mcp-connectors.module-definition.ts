import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { McpConnectorsOptions } from "./mcp-connectors.options"

/** Configurable-module base of the mcp-connectors capability. */
const definition = new ConfigurableModuleBuilder<McpConnectorsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    McpConnectorsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: McpConnectorsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
