import { defineCapabilityModule } from "@starci/nest-kit"
import { AI_GATEWAY_OPTIONS } from "./ai-gateway.decorators"
import type { AiGatewayOptions } from "./ai-gateway.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AiGatewayOptions>({
    optionsInjectionToken: AI_GATEWAY_OPTIONS,
})
