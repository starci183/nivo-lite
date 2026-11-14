import { defineCapabilityModule } from "@starci/nest-kit"
import type { YoutubeProviderOptions } from "./youtube-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<YoutubeProviderOptions>()
