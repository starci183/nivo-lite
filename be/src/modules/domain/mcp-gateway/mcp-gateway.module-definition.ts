import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { MCP_GATEWAY_OPTIONS } from "./mcp-gateway.decorators"
import type { McpGatewayOptions } from "./mcp-gateway.options"

/** Configurable-module base of the MCP gateway; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<McpGatewayOptions>({
    optionsInjectionToken: MCP_GATEWAY_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    McpGatewayOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: McpGatewayOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
