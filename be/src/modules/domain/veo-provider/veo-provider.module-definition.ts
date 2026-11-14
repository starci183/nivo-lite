import { defineCapabilityModule } from "@starci/nest-kit"
import type { VeoProviderOptions } from "./veo-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VeoProviderOptions>()
