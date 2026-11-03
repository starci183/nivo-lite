import { defineCapabilityModule } from "@starci/nest-kit"
import { BRAIN_OPTIONS } from "./brain.decorators"
import type { BrainOptions } from "./brain.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BrainOptions>({
    optionsInjectionToken: BRAIN_OPTIONS,
})
