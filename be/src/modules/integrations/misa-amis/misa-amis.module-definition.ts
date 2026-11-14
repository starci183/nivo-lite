import { defineCapabilityModule } from "@starci/nest-kit"
import { MISA_AMIS_OPTIONS } from "./misa-amis.decorators"
import type { MisaAmisOptions } from "./misa-amis.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<MisaAmisOptions>({
    optionsInjectionToken: MISA_AMIS_OPTIONS,
})
