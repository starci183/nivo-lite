import { defineCapabilityModule } from "@starci/nest-kit"
import type { PayosProviderOptions } from "./payos-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PayosProviderOptions>()
