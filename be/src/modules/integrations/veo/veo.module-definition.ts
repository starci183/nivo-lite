import { defineCapabilityModule } from "@starci/nest-kit"
import { VEO_OPTIONS } from "./veo.decorators"
import type { VeoOptions } from "./veo.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<VeoOptions>({
    optionsInjectionToken: VEO_OPTIONS,
})
