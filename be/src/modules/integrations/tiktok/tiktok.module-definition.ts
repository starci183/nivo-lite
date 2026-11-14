import { defineCapabilityModule } from "@starci/nest-kit"
import { TIKTOK_OPTIONS } from "./tiktok.decorators"
import type { TiktokOptions } from "./tiktok.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<TiktokOptions>({
    optionsInjectionToken: TIKTOK_OPTIONS,
})
