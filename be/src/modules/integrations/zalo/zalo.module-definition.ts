import { defineCapabilityModule } from "@starci/nest-kit"
import { ZALO_OPTIONS } from "./zalo.decorators"
import type { ZaloOptions } from "./zalo.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<ZaloOptions>({
    optionsInjectionToken: ZALO_OPTIONS,
})
