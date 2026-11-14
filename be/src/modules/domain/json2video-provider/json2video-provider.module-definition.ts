import { defineCapabilityModule } from "@starci/nest-kit"
import type { Json2VideoProviderOptions } from "./json2video-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<Json2VideoProviderOptions>()
