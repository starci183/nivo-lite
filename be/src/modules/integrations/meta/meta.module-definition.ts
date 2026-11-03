import { defineCapabilityModule } from "@starci/nest-kit"
import { META_OPTIONS } from "./meta.decorators"
import type { MetaOptions } from "./meta.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<MetaOptions>({
    optionsInjectionToken: META_OPTIONS,
})
