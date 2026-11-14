import { defineCapabilityModule } from "@starci/nest-kit"
import { INET_OPTIONS } from "./inet.decorators"
import type { InetOptions } from "./inet.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<InetOptions>({
    optionsInjectionToken: INET_OPTIONS,
})
