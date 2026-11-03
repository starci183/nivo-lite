import { defineCapabilityModule } from "@starci/nest-kit"
import type { VideoMusicOptions } from "./video-music.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<VideoMusicOptions>()
