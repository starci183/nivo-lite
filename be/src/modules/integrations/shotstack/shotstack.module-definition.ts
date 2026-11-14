import { defineCapabilityModule } from "@starci/nest-kit"
import { SHOTSTACK_OPTIONS } from "./shotstack.decorators"
import type { ShotstackOptions } from "./shotstack.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<ShotstackOptions>({
    optionsInjectionToken: SHOTSTACK_OPTIONS,
})
