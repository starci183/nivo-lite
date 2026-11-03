import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { McpGatewayReceiptsOptions } from "./mcp-gateway-receipts.options"

/** The configurable-module base of MCP gateway receipts; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<McpGatewayReceiptsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    McpGatewayReceiptsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: McpGatewayReceiptsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
