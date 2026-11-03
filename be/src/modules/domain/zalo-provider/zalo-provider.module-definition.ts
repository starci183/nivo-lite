import { defineCapabilityModule } from "@starci/nest-kit"
import { ZALO_PROVIDER_OPTIONS } from "./zalo-provider.decorators"
import type { ZaloProviderOptions } from "./zalo-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ZaloProviderOptions>({
    optionsInjectionToken: ZALO_PROVIDER_OPTIONS,
})
