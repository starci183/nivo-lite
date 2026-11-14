import { defineCapabilityModule } from "@starci/nest-kit"
import type { ZaloZnsProviderOptions } from "./zalo-zns-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ZaloZnsProviderOptions>()
