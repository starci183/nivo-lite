import { defineCapabilityModule } from "@starci/nest-kit"
import type { MisaAmisProviderOptions } from "./misa-amis-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MisaAmisProviderOptions>()
