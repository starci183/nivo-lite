import { defineCapabilityModule } from "@starci/nest-kit"
import { CREATOMATE_OPTIONS } from "./creatomate.decorators"
import type { CreatomateOptions } from "./creatomate.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<CreatomateOptions>({
    optionsInjectionToken: CREATOMATE_OPTIONS,
})
