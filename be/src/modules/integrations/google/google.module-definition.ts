import { defineCapabilityModule } from "@starci/nest-kit"
import { GOOGLE_OPTIONS } from "./google.decorators"
import type { GoogleOptions } from "./google.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<GoogleOptions>({
    optionsInjectionToken: GOOGLE_OPTIONS,
})
