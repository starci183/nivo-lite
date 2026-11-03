import { defineCapabilityModule } from "@starci/nest-kit"
import { HIRING_OPTIONS } from "./hiring.decorators"
import type { HiringOptions } from "./hiring.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<HiringOptions>({
    optionsInjectionToken: HIRING_OPTIONS,
})
