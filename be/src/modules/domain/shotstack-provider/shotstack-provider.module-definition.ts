import { defineCapabilityModule } from "@starci/nest-kit"
import type { ShotstackProviderOptions } from "./shotstack-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ShotstackProviderOptions>()
