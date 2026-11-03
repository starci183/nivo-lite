import { defineCapabilityModule } from "@starci/nest-kit"
import type { VideoRendersOptions } from "./video-renders.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VideoRendersOptions>()
