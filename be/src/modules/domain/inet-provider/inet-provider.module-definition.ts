import { defineCapabilityModule } from "@starci/nest-kit"
import type { InetProviderOptions } from "./inet-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<InetProviderOptions>()
