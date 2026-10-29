import { ConfigurableModuleBuilder } from "@nestjs/common"
import { AI_GATEWAY_OPTIONS } from "./ai-gateway.decorators"
import type { AiGatewayOptions } from "./ai-gateway.options"

/** The configurable-module base of the AI pool; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AiGatewayOptions>({
    optionsInjectionToken: AI_GATEWAY_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
