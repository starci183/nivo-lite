import { defineCapabilityModule } from "@starci/nest-kit"
import type { TinoProviderOptions } from "./tino-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<TinoProviderOptions>()
