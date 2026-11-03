import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { AI_GATEWAY_OPTIONS } from "./ai-gateway.decorators"
import type { AiGatewayOptions } from "./ai-gateway.options"

/** The configurable-module base of the AI pool; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<AiGatewayOptions>({
    optionsInjectionToken: AI_GATEWAY_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AiGatewayOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AiGatewayOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
