import { defineCapabilityModule } from "@starci/nest-kit"
import { SEPAY_OPTIONS } from "./sepay.decorators"
import type { SepayOptions } from "./sepay.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<SepayOptions>({
    optionsInjectionToken: SEPAY_OPTIONS,
})
