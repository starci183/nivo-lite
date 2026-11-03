import { defineCapabilityModule } from "@starci/nest-kit"
import { CONTENT_AI_OPTIONS } from "./content-agent.decorators"
import type { ContentAiOptions } from "./content-ai.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentAiOptions>({
    optionsInjectionToken: CONTENT_AI_OPTIONS,
})
