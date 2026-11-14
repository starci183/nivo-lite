import { defineCapabilityModule } from "@starci/nest-kit"
import type { TiktokProviderOptions } from "./tiktok-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<TiktokProviderOptions>()
