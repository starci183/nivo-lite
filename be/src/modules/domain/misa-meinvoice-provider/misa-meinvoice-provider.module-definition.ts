import { defineCapabilityModule } from "@starci/nest-kit"
import type { MisaMeinvoiceProviderOptions } from "./misa-meinvoice-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MisaMeinvoiceProviderOptions>()
