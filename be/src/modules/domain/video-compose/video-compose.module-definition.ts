import { defineCapabilityModule } from "@starci/nest-kit"
import type { VideoComposeOptions } from "./video-compose.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VideoComposeOptions>()
