import { defineCapabilityModule } from "@starci/nest-kit"
import type { SepayProviderOptions } from "./sepay-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<SepayProviderOptions>()
