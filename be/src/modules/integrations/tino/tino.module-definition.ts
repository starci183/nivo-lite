import { defineCapabilityModule } from "@starci/nest-kit"
import { TINO_OPTIONS } from "./tino.decorators"
import type { TinoOptions } from "./tino.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<TinoOptions>({
    optionsInjectionToken: TINO_OPTIONS,
})
