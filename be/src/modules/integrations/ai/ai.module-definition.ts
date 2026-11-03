import { defineCapabilityModule } from "@starci/nest-kit"
import { AI_OPTIONS } from "./ai.decorators"
import type { AiOptions } from "./ai.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AiOptions>({
    optionsInjectionToken: AI_OPTIONS,
})
