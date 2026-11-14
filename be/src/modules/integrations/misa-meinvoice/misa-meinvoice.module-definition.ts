import { defineCapabilityModule } from "@starci/nest-kit"
import { MISA_MEINVOICE_OPTIONS } from "./misa-meinvoice.decorators"
import type { MisaMeinvoiceOptions } from "./misa-meinvoice.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<MisaMeinvoiceOptions>({
    optionsInjectionToken: MISA_MEINVOICE_OPTIONS,
})
