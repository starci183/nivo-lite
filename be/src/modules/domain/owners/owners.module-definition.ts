import { defineCapabilityModule } from "@starci/nest-kit"
import { OWNERS_OPTIONS } from "./owners.decorators"
import type { OwnersOptions } from "./owners.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<OwnersOptions>({
    optionsInjectionToken: OWNERS_OPTIONS,
})
