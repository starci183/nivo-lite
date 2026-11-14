import { defineCapabilityModule } from "@starci/nest-kit"
import { PAYOS_OPTIONS } from "./payos.decorators"
import type { PayosOptions } from "./payos.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<PayosOptions>({
    optionsInjectionToken: PAYOS_OPTIONS,
})
